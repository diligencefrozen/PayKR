// PayKR reviews + Discord OAuth2 Worker.
// See docs/reviews-operator-guide.md for deployment, secrets and permissions.
//
// Secrets (never in source): DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN,
//   SESSION_SIGNING_SECRET, OAUTH_STATE_SECRET, AUTHOR_KEY_SECRET.
// Env vars: DISCORD_CLIENT_ID, DISCORD_REVIEW_CHANNEL_ID, DISCORD_REVIEW_BOT_ID,
//   ALLOWED_ORIGINS (comma list), REDIRECT_URIS (comma list), DISCORD_REPORT_CHANNEL_ID (optional).
const SCHEMA = 'paykr-review:v1';
const SESSION_TTL = 2 * 3600; // seconds
const STATE_TTL = 10 * 60 * 1000; // ms
const DISCORD_API = 'https://discord.com/api/v10';

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
const error = (code, status = 400) => json({ code }, status);

function base64url(bytes) {
  let s = '';
  if (bytes instanceof Uint8Array) for (const b of bytes) s += String.fromCharCode(b);
  else s = bytes;
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  return atob(s + pad);
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return base64url(new Uint8Array(sig));
}

async function sha256(message) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return base64url(new Uint8Array(digest));
}

function cors(env, request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const isAllowed = allowed.includes(origin);
  return {
    isAllowed,
    headers: isAllowed
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          Vary: 'Origin',
        }
      : {},
  };
}

// --- session helpers ------------------------------------------------------
async function sessionPayload(request, env) {
  const header = request.headers.get('Authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!bearer) return null;
  const parts = bearer.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = await hmac(env.SESSION_SIGNING_SECRET, payload);
  if (expected !== sig) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data; // { sub, displayName, authorKey, exp }
  } catch {
    return null;
  }
}

async function createSession(env, userId, displayName) {
  const authorKey = await hmac(env.AUTHOR_KEY_SECRET, userId);
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ sub: userId, displayName, authorKey, exp })));
  const sig = await hmac(env.SESSION_SIGNING_SECRET, payload);
  return { bearer: payload + '.' + sig, displayName, authorKey, exp };
}

// --- Discord helpers ------------------------------------------------------
async function discord(env, path, init = {}) {
  const res = await fetch(DISCORD_API + path, {
    ...init,
    headers: { Authorization: 'Bot ' + env.DISCORD_BOT_TOKEN, 'Content-Type': 'application/json', ...init.headers },
  });
  return res;
}

function publicReviewFromMessage(message) {
  const embed = message.embeds?.[0];
  const fields = Object.fromEntries((embed?.fields || []).map((f) => [f.name, f.value]));
  return {
    messageId: message.id,
    placeId: fields.placeId || '',
    placeName: fields.placeName || '',
    paymentStatus: ['available', 'unavailable', 'unspecified'].includes(fields.paymentStatus)
      ? fields.paymentStatus
      : 'unspecified',
    content: message.content || '',
    displayName: fields.displayName || '',
    createdAt: message.timestamp || null,
    authorKey: fields.authorKey || '',
  };
}

function validMessage(message, env) {
  const embed = message.embeds?.[0];
  return (
    message.author?.id === env.DISCORD_REVIEW_BOT_ID &&
    embed?.title === SCHEMA &&
    embed?.provider?.name === 'kakao'
  );
}

// Aggregate per-place statuses: latest valid report per account only.
function aggregate(messages, placeIds) {
  const wanted = new Set(placeIds.map(String));
  const byPlace = new Map();
  const latest = new Map(); // `${placeId}:${authorKey}` -> row
  for (const message of messages) {
    const row = publicReviewFromMessage(message);
    if (!wanted.has(row.placeId) || row.paymentStatus === 'unspecified') continue;
    const key = row.placeId + ':' + row.authorKey;
    const prev = latest.get(key);
    if (!prev || new Date(row.createdAt) > new Date(prev.createdAt)) latest.set(key, row);
  }
  for (const row of latest.values()) {
    const bucket = byPlace.get(row.placeId) || { success: 0, fail: 0, latestAt: null };
    if (row.paymentStatus === 'available') bucket.success++;
    else if (row.paymentStatus === 'unavailable') bucket.fail++;
    if (!bucket.latestAt || row.createdAt > bucket.latestAt) bucket.latestAt = row.createdAt;
    byPlace.set(row.placeId, bucket);
  }
  const out = {};
  for (const id of placeIds) out[id] = byPlace.get(String(id)) || { success: 0, fail: 0, latestAt: null, complete: true };
  return out;
}

// --- handlers -------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const { headers: corsHeaders, isAllowed } = cors(env, request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (!isAllowed) return error('ORIGIN_NOT_ALLOWED', 403);

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    try {
      if (path === '/api/session') {
        const session = await sessionPayload(request, env);
        if (!session) return error('UNAUTHORIZED', 401);
        return json(
          { authed: true, displayName: session.displayName, expiresAt: new Date(session.exp * 1000).toISOString() },
          200,
          corsHeaders,
        );
      }

      if (path === '/api/auth/discord/start') {
        const body = await request.json().catch(() => null);
        const challenge = String(body?.challenge || '').slice(0, 128);
        const redirect = String(body?.redirect || '');
        const allowedRedirects = (env.REDIRECT_URIS || '').split(',').map((s) => s.trim());
        if (!challenge || !allowedRedirects.includes(redirect)) return error('INVALID_REDIRECT', 400);
        const nonce = crypto.randomUUID();
        const exp = Date.now() + STATE_TTL;
        const state = [nonce, challenge, redirect, exp].join('|') + '.' + (await hmac(env.OAUTH_STATE_SECRET, [nonce, challenge, redirect, exp].join('|')));
        const params = new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          response_type: 'code',
          redirect_uri: redirect,
          scope: 'identify',
          state,
          code_challenge: challenge,
          code_challenge_method: 'S256',
          prompt: 'consent',
        });
        return json(
          { state, authorizeUrl: 'https://discord.com/oauth2/authorize?' + params.toString() },
          200,
          corsHeaders,
        );
      }

      if (path === '/api/auth/discord/exchange') {
        const body = await request.json().catch(() => null);
        const { code, state, verifier } = body || {};
        if (!code || !state || !verifier) return error('INVALID_REQUEST', 400);
        const [raw, sig] = String(state).split('.');
        const expected = await hmac(env.OAUTH_STATE_SECRET, raw);
        if (sig !== expected) return error('AUTH_STATE_MISMATCH', 400);
        const [nonce, challenge, redirect, exp] = raw.split('|');
        if (!challenge || Date.now() > Number(exp)) return error('AUTH_STATE_EXPIRED', 400);
        if ((await sha256(verifier)) !== challenge) return error('AUTH_PKCE_MISMATCH', 400);

        const tokenRes = await fetch(DISCORD_API + '/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: env.DISCORD_CLIENT_ID,
            client_secret: env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirect,
            code_verifier: verifier,
          }),
        });
        if (!tokenRes.ok) return error('AUTH_EXCHANGE_FAILED', 401);
        const token = await tokenRes.json();
        const userRes = await fetch(DISCORD_API + '/users/@me', {
          headers: { Authorization: 'Bearer ' + token.access_token },
        });
        if (!userRes.ok) return error('AUTH_USER_FAILED', 401);
        const user = await userRes.json();
        const session = await createSession(env, user.id, user.global_name || user.username);
        return json(
          { displayName: session.displayName, expiresAt: new Date(session.exp * 1000).toISOString(), bearer: session.bearer },
          200,
          corsHeaders,
        );
      }

      if (path === '/api/review-summaries') {
        const body = await request.json().catch(() => null);
        const placeIds = [...new Set((body?.placeIds || []).map(String).filter(Boolean))].slice(0, 100);
        if (!placeIds.length) return json({}, 200, corsHeaders);
        const messages = await fetchChannelMessages(env, 100);
        return json(aggregate(messages, placeIds), 200, corsHeaders);
      }

      if (path === '/api/reviews' && request.method === 'GET') {
        const placeId = url.searchParams.get('placeId');
        if (!placeId) return error('INVALID_REQUEST', 400);
        const messages = await fetchChannelMessages(env, 100);
        const rows = messages
          .filter((m) => validMessage(m, env) && publicReviewFromMessage(m).placeId === placeId)
          .map(publicReviewFromMessage);
        return json({ items: rows, cursor: null, complete: true }, 200, corsHeaders);
      }

      if (path === '/api/reviews' && request.method === 'POST') {
        const session = await sessionPayload(request, env);
        if (!session) return error('UNAUTHORIZED', 401);
        const body = await request.json().catch(() => null);
        const placeId = String(body?.placeId || '').slice(0, 128);
        const placeName = String(body?.placeName || '').slice(0, 120);
        const paymentStatus = ['available', 'unavailable', 'unspecified'].includes(body?.paymentStatus)
          ? body.paymentStatus
          : 'unspecified';
        const content = String(body?.content || '').slice(0, 500);
        if (!placeId || !placeName) return error('INVALID_REQUEST', 400);
        if (paymentStatus === 'unspecified' && !content.trim()) return error('EMPTY_SUBMISSION', 400);

        const embed = {
          title: SCHEMA,
          provider: { name: 'kakao' },
          fields: [
            { name: 'placeId', value: placeId },
            { name: 'placeName', value: placeName },
            { name: 'paymentStatus', value: paymentStatus },
            { name: 'displayName', value: session.displayName },
            { name: 'authorKey', value: session.authorKey },
          ],
        };
        const res = await discord(env, '/channels/' + env.DISCORD_REVIEW_CHANNEL_ID + '/messages', {
          method: 'POST',
          body: JSON.stringify({ content: content.trim() || undefined, embeds: [embed], allowed_mentions: { parse: [] } }),
        });
        if (!res.ok) return error('DISCORD_POST_FAILED', 502);
        const message = await res.json();
        return json(publicReviewFromMessage({ ...message, embeds: [embed] }), 201, corsHeaders);
      }

      if (path.startsWith('/api/reviews/') && request.method === 'DELETE') {
        const session = await sessionPayload(request, env);
        if (!session) return error('UNAUTHORIZED', 401);
        const messageId = path.split('/').pop();
        const res = await discord(env, '/channels/' + env.DISCORD_REVIEW_CHANNEL_ID + '/messages/' + messageId);
        if (res.status === 404) return error('NOT_FOUND', 404);
        if (!res.ok) return error('DISCORD_FETCH_FAILED', 502);
        const message = await res.json();
        if (!validMessage(message, env)) return error('NOT_FOUND', 404);
        if (publicReviewFromMessage(message).authorKey !== session.authorKey) return error('FORBIDDEN', 403);
        const del = await discord(env, '/channels/' + env.DISCORD_REVIEW_CHANNEL_ID + '/messages/' + messageId, { method: 'DELETE' });
        if (!del.ok && del.status !== 404) return error('DISCORD_DELETE_FAILED', 502);
        return json({ ok: true }, 200, corsHeaders);
      }

      if (path.startsWith('/api/reviews/') && path.endsWith('/report') && request.method === 'POST') {
        const session = await sessionPayload(request, env);
        if (!session) return error('UNAUTHORIZED', 401);
        const reason = String((await request.json().catch(() => ({})))?.reason || '').slice(0, 300);
        if (env.DISCORD_REPORT_CHANNEL_ID) {
          await discord(env, '/channels/' + env.DISCORD_REPORT_CHANNEL_ID + '/messages', {
            method: 'POST',
            body: JSON.stringify({ content: 'Report on message ' + path.split('/')[3] + (reason ? ': ' + reason : ''), allowed_mentions: { parse: [] } }),
          }).catch(() => {});
        }
        return json({ ok: true }, 200, corsHeaders);
      }

      return error('NOT_FOUND', 404);
    } catch {
      return error('INTERNAL_ERROR', 500);
    }
  },
};

let channelCache = null;
let channelCacheAt = 0;
async function fetchChannelMessages(env, limit = 100) {
  if (channelCache && Date.now() - channelCacheAt < 30000) return channelCache;
  const res = await discord(env, '/channels/' + env.DISCORD_REVIEW_CHANNEL_ID + '/messages?limit=' + limit);
  if (!res.ok) return [];
  channelCache = await res.json();
  channelCacheAt = Date.now();
  return channelCache;
}

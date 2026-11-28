// Kakao Local REST keyword search proxy for the PayKR hybrid map.
// Holds the Kakao REST key as a secret and forwards only keyword/bounds/page to
// the fixed Kakao endpoint. Never exposes the key or accepts arbitrary URLs.
//
// Secrets: KAKAO_REST_KEY (wrangler secret put KAKAO_REST_KEY).
// Vars:    ALLOWED_ORIGINS (comma list), MAX_DAILY_REQUESTS (number).
import { validateQuery, parseRect, mapKakaoResponse, kakaoErrorCode, normalizePage } from './kakao.js';

const KAKAO_ENDPOINT = 'https://dapi.kakao.com/v2/local/search/keyword.json';

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
const error = (code, status = 400, extra = {}) => json({ code }, status, extra);

function cors(env, request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const isAllowed = allowed.includes(origin);
  return {
    isAllowed,
    headers: isAllowed
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          Vary: 'Origin',
        }
      : {},
  };
}

// In-memory per-isolate daily budget. Durable enforcement (KV/D1) is a separate
// operator upgrade; this is a fail-safe bound, not a replacement for rate limiting.
let dailyCount = 0;
let dailyDay = '';

export default {
  async fetch(request, env) {
    const { headers: corsHeaders, isAllowed } = cors(env, request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (!isAllowed) return error('ORIGIN_NOT_ALLOWED', 403);
    if (request.method !== 'GET') return error('METHOD_NOT_ALLOWED', 405);

    const url = new URL(request.url);
    if (url.pathname.replace(/\/+$/, '') !== '/api/search') return error('NOT_FOUND', 404);

    const query = validateQuery(url.searchParams.get('query'));
    if (!query) return error('INVALID_QUERY', 400);

    const rectRaw = url.searchParams.get('rect');
    const rect = rectRaw ? parseRect(rectRaw) : null;
    if (rectRaw && !rect) return error('INVALID_RECT', 400);

    const page = normalizePage(url.searchParams.get('page'));
    const maxDaily = Number(env.MAX_DAILY_REQUESTS || 100000);
    const today = new Date().toISOString().slice(0, 10);
    if (today !== dailyDay) {
      dailyDay = today;
      dailyCount = 0;
    }
    if (dailyCount >= maxDaily) return error('DAILY_QUOTA_EXCEEDED', 429);
    dailyCount++;

    const params = new URLSearchParams({ query, page: String(page), size: '15' });
    if (rect) params.set('rect', rect.join(','));

    const upstream = await fetch(KAKAO_ENDPOINT + '?' + params.toString(), {
      headers: { Authorization: 'KakaoAK ' + env.KAKAO_REST_KEY, Accept: 'application/json' },
    });

    if (!upstream.ok) {
      const retryAfter = upstream.headers.get('Retry-After');
      const status = upstream.status === 429 ? 429 : upstream.status === 401 || upstream.status === 403 ? 502 : 502;
      return json(
        { code: kakaoErrorCode(upstream.status) },
        status,
        { ...corsHeaders, ...(retryAfter ? { 'Retry-After': retryAfter } : {}) },
      );
    }

    const data = await upstream.json().catch(() => ({}));
    return json(mapKakaoResponse(data), 200, corsHeaders);
  },
};

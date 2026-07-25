const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const API_VERSION = '2022-11-28';
const FORUM_MARKER = '<!-- paykr-forum:v1 -->';
const CATEGORY_MARKER_PREFIX = 'paykr-category:';
const TITLE_PREFIX = '커뮤니티';
const MAX_SESSION_SECONDS = 8 * 60 * 60;
const VALID_CATEGORIES = new Set([
  'free',
  'tips',
  'question',
  'review',
  'saving',
  'work',
  'student',
  'suggestion'
]);

class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    const origin = request.headers.get('Origin') || '';

    try {
      validateEnvironment(env);
      assertAllowedOrigin(origin, env);

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: responseHeaders(origin, {
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Max-Age': '86400'
          })
        });
      }

      const data = await routeRequest(request, env, origin);
      return jsonResponse(data, 200, origin);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.message : 'OAuth Worker 내부 오류가 발생했습니다.';

      if (!(error instanceof HttpError) || status >= 500) {
        console.error(JSON.stringify({
          requestId,
          message: error?.message,
          stack: error?.stack
        }));
      }

      return jsonResponse({ error: message, requestId }, status, origin);
    }
  }
};

async function routeRequest(request, env, origin) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/oauth/token' && request.method === 'POST') {
    return exchangeOAuthCode(request, env, origin);
  }

  if (!path.startsWith('/api/')) {
    throw new HttpError(404, '요청한 경로를 찾을 수 없습니다.');
  }

  const session = await requireSession(request, env);

  if (path === '/api/session' && request.method === 'GET') {
    return { user: session.user, expiresAt: session.exp };
  }

  if (path === '/api/issues' && request.method === 'GET') {
    return listIssues(url, env, session.githubToken);
  }

  if (path === '/api/issues' && request.method === 'POST') {
    return createIssue(request, env, session.githubToken);
  }

  if (path === '/api/repository-comments' && request.method === 'GET') {
    return listRepositoryComments(url, env, session.githubToken);
  }

  const commentMatch = path.match(/^\/api\/issues\/(\d+)\/comments$/);
  if (commentMatch && request.method === 'GET') {
    return listIssueComments(url, env, session.githubToken, Number(commentMatch[1]));
  }
  if (commentMatch && request.method === 'POST') {
    return createIssueComment(request, env, session.githubToken, Number(commentMatch[1]));
  }

  const reactionMatch = path.match(/^\/api\/issues\/(\d+)\/reaction$/);
  if (reactionMatch && request.method === 'POST') {
    return toggleIssueReaction(env, session, Number(reactionMatch[1]));
  }

  throw new HttpError(404, '요청한 API 작업을 찾을 수 없습니다.');
}

async function exchangeOAuthCode(request, env, origin) {
  const payload = await readJsonBody(request, 12_000);
  const code = requireString(payload.code, '인증 코드', 8, 512);
  const codeVerifier = requireString(payload.codeVerifier, 'PKCE 검증 값', 43, 128);
  const redirectUri = requireString(payload.redirectUri, '콜백 주소', 8, 2_000);

  if (!/^[A-Za-z0-9._~-]+$/.test(codeVerifier)) {
    throw new HttpError(400, 'PKCE 검증 값의 형식이 올바르지 않습니다.');
  }

  let redirectUrl;
  try {
    redirectUrl = new URL(redirectUri);
  } catch {
    throw new HttpError(400, '콜백 주소가 올바르지 않습니다.');
  }

  if (redirectUrl.origin !== origin) {
    throw new HttpError(400, '콜백 주소와 요청 출처가 일치하지 않습니다.');
  }

  const tokenRequest = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'PayKR-Forum-OAuth'
    },
    body: tokenRequest.toString()
  });
  const tokenPayload = await parseJsonResponse(tokenResponse);

  if (!tokenResponse.ok || !tokenPayload?.access_token) {
    const message = tokenPayload?.error_description || tokenPayload?.error || 'GitHub 인증 코드를 교환하지 못했습니다.';
    throw new HttpError(401, message);
  }

  const userResult = await githubApi(tokenPayload.access_token, '/user');
  const githubUser = userResult.data;
  if (!githubUser?.id || !githubUser?.login) {
    throw new HttpError(401, 'GitHub 사용자 정보를 확인하지 못했습니다.');
  }

  const tokenExpiresIn = Number(tokenPayload.expires_in);
  const sessionSeconds = Number.isFinite(tokenExpiresIn) && tokenExpiresIn > 0
    ? Math.min(tokenExpiresIn, MAX_SESSION_SECONDS)
    : MAX_SESSION_SECONDS;
  const expiresAt = Math.floor(Date.now() / 1000) + sessionSeconds;
  const user = {
    id: githubUser.id,
    login: githubUser.login,
    avatarUrl: githubUser.avatar_url,
    htmlUrl: githubUser.html_url
  };

  const session = await sealSession({
    ver: 1,
    aud: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
    exp: expiresAt,
    githubToken: tokenPayload.access_token,
    user
  }, env.SESSION_SECRET);

  return { session, user, expiresAt };
}

async function listIssues(url, env, githubToken) {
  const params = new URLSearchParams({
    state: 'all',
    sort: allowedValue(url.searchParams.get('sort'), ['created', 'updated', 'comments'], 'created'),
    direction: allowedValue(url.searchParams.get('direction'), ['asc', 'desc'], 'desc'),
    per_page: String(clampInteger(url.searchParams.get('per_page'), 1, 100, 100)),
    page: String(clampInteger(url.searchParams.get('page'), 1, 100, 1))
  });
  const result = await githubApi(githubToken, `${repositoryApiPath(env)}/issues?${params}`);
  return result.data;
}

async function createIssue(request, env, githubToken) {
  const payload = await readJsonBody(request, 16_000);
  const category = requireString(payload.category, '카테고리', 2, 32);
  if (!VALID_CATEGORIES.has(category)) {
    throw new HttpError(400, '지원하지 않는 카테고리입니다.');
  }

  const title = normalizeTitle(requireString(payload.title, '제목', 2, 120));
  const content = sanitizeForumContent(requireString(payload.content, '내용', 1, 5_000));
  if (!content) {
    throw new HttpError(400, '게시글 내용을 입력해주세요.');
  }

  const body = `${FORUM_MARKER}\n<!-- ${CATEGORY_MARKER_PREFIX}${category} -->\n\n${content}`;
  const result = await githubApi(githubToken, `${repositoryApiPath(env)}/issues`, {
    method: 'POST',
    body: {
      title: `[${TITLE_PREFIX}:${category}] ${title}`,
      body
    }
  });
  return result.data;
}

async function listRepositoryComments(url, env, githubToken) {
  const params = new URLSearchParams({
    sort: allowedValue(url.searchParams.get('sort'), ['created', 'updated'], 'created'),
    direction: allowedValue(url.searchParams.get('direction'), ['asc', 'desc'], 'desc'),
    per_page: String(clampInteger(url.searchParams.get('per_page'), 1, 100, 100)),
    page: String(clampInteger(url.searchParams.get('page'), 1, 100, 1))
  });
  const result = await githubApi(githubToken, `${repositoryApiPath(env)}/issues/comments?${params}`);
  return result.data;
}

async function listIssueComments(url, env, githubToken, issueNumber) {
  assertIssueNumber(issueNumber);
  const params = new URLSearchParams({
    per_page: String(clampInteger(url.searchParams.get('per_page'), 1, 100, 100)),
    page: String(clampInteger(url.searchParams.get('page'), 1, 100, 1))
  });
  const result = await githubApi(
    githubToken,
    `${repositoryApiPath(env)}/issues/${issueNumber}/comments?${params}`
  );
  return result.data;
}

async function createIssueComment(request, env, githubToken, issueNumber) {
  assertIssueNumber(issueNumber);
  await requireRepositoryIssue(env, githubToken, issueNumber);
  const payload = await readJsonBody(request, 8_000);
  const content = requireString(payload.content, '댓글', 1, 2_000).trim();

  const result = await githubApi(
    githubToken,
    `${repositoryApiPath(env)}/issues/${issueNumber}/comments`,
    { method: 'POST', body: { body: content } }
  );
  return result.data;
}

async function toggleIssueReaction(env, session, issueNumber) {
  assertIssueNumber(issueNumber);
  await requireRepositoryIssue(env, session.githubToken, issueNumber);

  const reactionPath = `${repositoryApiPath(env)}/issues/${issueNumber}/reactions`;
  const reactionList = await githubApi(
    session.githubToken,
    `${reactionPath}?content=${encodeURIComponent('+1')}&per_page=100`
  );
  const ownReaction = reactionList.data.find((reaction) => reaction.user?.id === session.user.id);

  if (ownReaction) {
    await githubApi(
      session.githubToken,
      `${reactionPath}/${ownReaction.id}`,
      { method: 'DELETE' }
    );
    return { active: false, delta: -1 };
  }

  const created = await githubApi(
    session.githubToken,
    reactionPath,
    { method: 'POST', body: { content: '+1' } }
  );
  return {
    active: true,
    delta: created.status === 201 ? 1 : 0
  };
}

async function requireRepositoryIssue(env, githubToken, issueNumber) {
  const result = await githubApi(githubToken, `${repositoryApiPath(env)}/issues/${issueNumber}`);
  const issue = result.data;
  if (issue.pull_request) {
    throw new HttpError(403, 'Pull Request에는 커뮤니티 작업을 수행할 수 없습니다.');
  }
  if (issue.locked) {
    throw new HttpError(423, '잠긴 게시글에는 이 작업을 수행할 수 없습니다.');
  }
  return issue;
}

async function githubApi(githubToken, path, { method = 'GET', body } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${githubToken}`,
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'PayKR-Forum-Worker'
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = response.status === 204 ? null : await parseJsonResponse(response);

  if (!response.ok) {
    const status = response.status === 401 ? 401 : response.status;
    const message = githubErrorMessage(response.status, data?.message);
    throw new HttpError(status, message);
  }

  return { data, status: response.status };
}

function githubErrorMessage(status, githubMessage) {
  if (status === 401) return 'GitHub 로그인 세션이 만료되었습니다.';
  if (status === 403) return '이 작업을 수행할 GitHub 권한이 없거나 요청 한도를 초과했습니다.';
  if (status === 404) return 'GitHub 게시글을 찾을 수 없습니다.';
  if (status === 410) return '저장소의 Issues 기능을 사용할 수 없습니다.';
  if (status === 422) return '입력값을 처리할 수 없거나 GitHub의 게시 제한에 걸렸습니다.';
  return githubMessage || 'GitHub API 요청에 실패했습니다.';
}

async function requireSession(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    throw new HttpError(401, 'GitHub 로그인이 필요합니다.');
  }

  const sealedSession = authorization.slice(7).trim();
  if (!sealedSession) throw new HttpError(401, 'GitHub 로그인이 필요합니다.');

  let session;
  try {
    session = await openSession(sealedSession, env.SESSION_SECRET);
  } catch {
    throw new HttpError(401, '로그인 세션이 올바르지 않습니다.');
  }

  const expectedAudience = `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
  if (
    session.ver !== 1
    || session.aud !== expectedAudience
    || !session.githubToken
    || !session.user?.id
    || !session.user?.login
    || !Number.isFinite(session.exp)
    || session.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new HttpError(401, '로그인 세션이 만료되었습니다.');
  }

  return session;
}

async function sealSession(payload, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await sessionKey(secret);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

async function openSession(value, secret) {
  const [ivPart, ciphertextPart, extra] = value.split('.');
  if (!ivPart || !ciphertextPart || extra !== undefined) throw new Error('Malformed session');
  const iv = base64UrlToBytes(ivPart);
  if (iv.byteLength !== 12) throw new Error('Malformed IV');
  const ciphertext = base64UrlToBytes(ciphertextPart);
  const key = await sessionKey(secret);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function sessionKey(secret) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function validateEnvironment(env) {
  const required = [
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'SESSION_SECRET',
    'GITHUB_OWNER',
    'GITHUB_REPO',
    'ALLOWED_ORIGINS'
  ];
  const missing = required.filter((key) => !String(env[key] || '').trim());
  if (missing.length > 0) {
    throw new HttpError(503, `Worker 환경 설정이 누락되었습니다: ${missing.join(', ')}`);
  }
  if (String(env.SESSION_SECRET).length < 32) {
    throw new HttpError(503, 'SESSION_SECRET은 32자 이상이어야 합니다.');
  }
}

function assertAllowedOrigin(origin, env) {
  const allowedOrigins = String(env.ALLOWED_ORIGINS)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!origin || !allowedOrigins.includes(origin)) {
    throw new HttpError(403, '허용되지 않은 요청 출처입니다.');
  }
}

function responseHeaders(origin, extra = {}) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Cache-Control': 'no-store, max-age=0',
    'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
    ...extra
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders(origin)
  });
}

async function readJsonBody(request, maxLength) {
  const text = await request.text();
  if (text.length > maxLength) throw new HttpError(413, '요청 본문이 너무 큽니다.');
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new HttpError(400, 'JSON 요청 형식이 올바르지 않습니다.');
  }
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(502, '외부 서비스가 올바르지 않은 응답을 반환했습니다.');
  }
}

function requireString(value, label, minLength, maxLength) {
  if (typeof value !== 'string') throw new HttpError(400, `${label}을(를) 입력해주세요.`);
  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    throw new HttpError(400, `${label} 길이는 ${minLength}자 이상 ${maxLength}자 이하여야 합니다.`);
  }
  return trimmed;
}

function normalizeTitle(value) {
  return value.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function sanitizeForumContent(value) {
  return value
    .replace(/<!--\s*paykr-forum:[\s\S]*?-->/gi, '')
    .replace(/<!--\s*paykr-category:[\s\S]*?-->/gi, '')
    .trim();
}

function repositoryApiPath(env) {
  return `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}`;
}

function assertIssueNumber(value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, '게시글 번호가 올바르지 않습니다.');
  }
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function allowedValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

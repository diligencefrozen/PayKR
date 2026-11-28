import assert from 'node:assert/strict';
import {
  validateQuery,
  parseRect,
  mapKakaoResponse,
  kakaoErrorCode,
  normalizePage,
} from '../workers/kakao-proxy/src/kakao.js';
import proxy from '../workers/kakao-proxy/src/index.js';

// Pure mapping/validation helpers.
assert.equal(validateQuery('  스타벅스  '), '스타벅스');
assert.equal(validateQuery('   '), null);
assert.equal(validateQuery('a'.repeat(200)).length, 100);
assert.deepEqual(parseRect('126.9,37.4,127.1,37.6'), [126.9, 37.4, 127.1, 37.6]);
assert.equal(parseRect('127.1,37.4,126.9,37.6'), null); // west >= east
assert.equal(parseRect('bad,values,here,no'), null);
assert.equal(parseRect('1,2,3'), null);
assert.equal(parseRect('100,30,101,31'), null); // out of Korea range
assert.deepEqual(mapKakaoResponse({ documents: [{ id: '1' }], meta: { is_end: false } }), { rows: [{ id: '1' }], more: true });
assert.deepEqual(mapKakaoResponse({ documents: [], meta: { is_end: true } }), { rows: [], more: false });
assert.deepEqual(mapKakaoResponse(null), { rows: [], more: false });
assert.equal(kakaoErrorCode(429), 'RATE_LIMITED');
assert.equal(kakaoErrorCode(401), 'KAKAO_AUTH');
assert.equal(kakaoErrorCode(403), 'KAKAO_AUTH');
assert.equal(kakaoErrorCode(500), 'KAKAO_ERROR');
assert.equal(kakaoErrorCode(400), 'KAKAO_REQUEST_FAILED');
assert.equal(normalizePage('2'), 2);
assert.equal(normalizePage('999'), 1);

// End-to-end handler with a mocked upstream Kakao API.
const env = { ALLOWED_ORIGINS: 'https://diligencefrozen.github.io', KAKAO_REST_KEY: 'test-key', MAX_DAILY_REQUESTS: '100000' };
const base = new Request('https://proxy.test/api/search?query=' + encodeURIComponent('스타벅스') + '&page=1', {
  headers: { Origin: 'https://diligencefrozen.github.io' },
});

let upstreamCall;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  upstreamCall = { url, init };
  return new Response(
    JSON.stringify({ documents: [{ id: '123', place_name: '스타벅스 강남역점', x: '127.0', y: '37.5' }], meta: { is_end: true } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
const ok = await proxy.fetch(base, env);
assert.equal(ok.status, 200);
assert.equal(ok.headers.get('Cache-Control'), 'no-store');
const okBody = await ok.json();
assert.equal(okBody.rows.length, 1);
assert.equal(okBody.rows[0].place_name, '스타벅스 강남역점');
assert.equal(okBody.more, false);
assert(upstreamCall.url.startsWith('https://dapi.kakao.com/v2/local/search/keyword.json?'));
assert.equal(upstreamCall.init.headers.Authorization, 'KakaoAK test-key');

// Invalid query is rejected without an upstream call.
const bad = await proxy.fetch(new Request('https://proxy.test/api/search?query=', { headers: { Origin: 'https://diligencefrozen.github.io' } }), env);
assert.equal(bad.status, 400);

// Disallowed origin.
const blocked = await proxy.fetch(new Request('https://proxy.test/api/search?query=x', { headers: { Origin: 'https://evil.example' } }), env);
assert.equal(blocked.status, 403);

// Upstream 429 maps to RATE_LIMITED and forwards Retry-After.
globalThis.fetch = async () => new Response(JSON.stringify({}), { status: 429, headers: { 'Retry-After': '5' } });
const limited = await proxy.fetch(base, env);
assert.equal(limited.status, 429);
assert.equal((await limited.json()).code, 'RATE_LIMITED');
assert.equal(limited.headers.get('Retry-After'), '5');

globalThis.fetch = originalFetch;

console.log(
  'PASS: Kakao REST proxy validation, rect parsing, response mapping, upstream authorization, origin allowlist, and 429 handling',
);

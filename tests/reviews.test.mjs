import assert from 'node:assert/strict';
import { deriveCommunityStatus, validSubmission, publicReview } from '../src/models/reviews.js';
import { ReviewsService, ReviewsError } from '../src/services/reviews.js';

// sessionStorage polyfill for the Node test environment.
const storage = new Map();
globalThis.sessionStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

assert.deepEqual(deriveCommunityStatus(null), { status: 'none', success: 0, fail: 0, latestAt: null });
assert.equal(deriveCommunityStatus({ success: 1, fail: 0 }).status, 'available');
assert.equal(deriveCommunityStatus({ success: 0, fail: 2 }).status, 'unavailable');
assert.equal(deriveCommunityStatus({ success: 1, fail: 1 }).status, 'conflict');
assert.equal(deriveCommunityStatus({ success: 2, fail: 1 }).success, 2);

assert(validSubmission({ paymentStatus: 'available', content: '' }));
assert(validSubmission({ paymentStatus: 'unspecified', content: 'text' }));
assert(!validSubmission({ paymentStatus: 'unspecified', content: '  ' }));
assert.equal(publicReview({ content: 'x'.repeat(600) }).content.length, 500);

const service = new ReviewsService({ apiBase: null, useMock: true });
assert.equal(service.useMock, true);
assert.deepEqual(await service.currentSession(), { authed: false });

// Writes require authentication; the server, not the UI, is the security boundary.
await assert.rejects(
  service.submit({ placeId: 'p1', placeName: 'Place 1', paymentStatus: 'available', content: 'worked' }),
  (e) => e instanceof ReviewsError && e.code === 'AUTH_REQUIRED',
);

// Mock PKCE round-trip (same-page flow used by the test suite).
const auth = await service.startAuth('/PayKR/');
assert(auth.state && auth.authorizeUrl.startsWith('#paykr-auth'));
const authParams = new URLSearchParams(auth.authorizeUrl.slice(auth.authorizeUrl.indexOf('?') + 1));
const session = await service.exchange(authParams.get('code'), authParams.get('state'), authParams.get('verifier'));
assert.equal(session.displayName, 'mapwalker');
assert.deepEqual(await service.currentSession(), { authed: true, displayName: 'mapwalker', expiresAt: session.expiresAt });

const posted = await service.submit({ placeId: 'p1', placeName: 'Place 1', paymentStatus: 'available', content: 'worked' });
assert.equal(posted.placeId, 'p1');
assert.equal(posted.paymentStatus, 'available');
assert.equal(posted.displayName, 'mapwalker');
assert(posted.messageId && posted.createdAt);

const list = await service.list('p1');
assert.equal(list.items.length, 1);
assert.equal(list.items[0].content, 'worked');
assert.equal(list.items[0].authorKey, undefined);

const summary = await service.summaries(['p1', 'p2']);
assert.equal(summary.p1.success, 1);
assert.equal(summary.p1.fail, 0);
assert.equal(summary.p2.success, 0);

const del = await service.remove(posted.messageId);
assert.equal(del.ok, true);
assert.equal((await service.list('p1')).items.length, 0);
assert.equal((await service.summaries(['p1'])).p1.success, 0);

service.logout();
assert.deepEqual(await service.currentSession(), { authed: false });
await assert.rejects(
  service.submit({ placeId: 'p1', placeName: 'x', paymentStatus: 'available' }),
  (e) => e.code === 'AUTH_REQUIRED',
);

// A rejected state never establishes a session.
const second = await service.startAuth('/PayKR/');
await assert.rejects(
  service.exchange('mock-code', 'wrong-state', 'v'),
  (e) => e.code === 'AUTH_STATE_MISMATCH',
);

console.log(
  'PASS: community status derivation, submission validation, mock OAuth round-trip, auth-gated writes, list/summary/delete lifecycle and state mismatch rejection',
);

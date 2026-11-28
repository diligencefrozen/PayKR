import { reviewsConfig } from '../config/reviews.js';
import { PAYMENT_STATUS, REVIEW_SCHEMA, publicReview } from '../models/reviews.js';

// In-memory store used when no Worker is configured (or when tests want hermetic behavior).
class MockStore {
  constructor() {
    this.reviews = new Map(); // placeId -> [{ messageId, ... }]
    this.sessions = new Map(); // bearer -> { displayName, expiresAt, authorKey }
    this.seq = 0;
    this.state = null; // { state, verifier, redirect }
  }
  nextId() {
    return 'mock-' + ++this.seq;
  }
}

const mock = new MockStore();

export class ReviewsError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function randomToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Minimal S256 challenge for the mock path only. The real Worker performs PKCE verification.
async function challengeFrom(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export class ReviewsService {
  constructor(config = reviewsConfig) {
    this.config = config;
    this.session = null; // { displayName, expiresAt, bearer }
    this.loadSession();
  }

  get useMock() {
    return !this.config.apiBase || this.config.useMock;
  }

  // --- session ------------------------------------------------------------
  loadSession() {
    try {
      const raw = sessionStorage.getItem('paykr-reviews-session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.expiresAt && Date.parse(parsed.expiresAt) > Date.now()) this.session = parsed;
        else sessionStorage.removeItem('paykr-reviews-session');
      }
    } catch {
      /* Storage may be disabled. */
    }
  }

  saveSession() {
    try {
      if (this.session) sessionStorage.setItem('paykr-reviews-session', JSON.stringify(this.session));
      else sessionStorage.removeItem('paykr-reviews-session');
    } catch {
      /* Storage may be disabled. */
    }
  }

  async currentSession() {
    if (this.useMock) {
      return this.session ? { authed: true, displayName: this.session.displayName, expiresAt: this.session.expiresAt } : { authed: false };
    }
    const res = await this.request('/api/session', { auth: true });
    return res.json();
  }

  async startAuth(returnPath) {
    const verifier = randomToken(43);
    const challenge = await challengeFrom(verifier);
    const localState = randomToken(24);
    if (this.useMock) {
      mock.state = { state: localState, verifier, redirect: returnPath };
      const params = new URLSearchParams({ state: localState, code: 'mock-code', verifier });
      return { state: localState, authorizeUrl: '#paykr-auth?' + params.toString() };
    }
    const res = await this.request('/api/auth/discord/start', {
      method: 'POST',
      body: { challenge, redirect: returnPath },
    });
    const data = await res.json();
    sessionStorage.setItem('paykr-oauth', JSON.stringify({ state: data.state, verifier, apiBase: this.config.apiBase, returnPath }));
    return data;
  }

  async exchange(code, state, verifier) {
    if (this.useMock) {
      if (!mock.state || mock.state.state !== state) throw new ReviewsError('AUTH_STATE_MISMATCH', 400);
      if (code !== 'mock-code') throw new ReviewsError('AUTH_CODE_INVALID', 400);
      this.session = { displayName: 'mapwalker', expiresAt: new Date(Date.now() + 2 * 3600000).toISOString(), bearer: 'mock-bearer' };
      this.saveSession();
      mock.state = null;
      return { displayName: this.session.displayName, expiresAt: this.session.expiresAt };
    }
    const res = await this.request('/api/auth/discord/exchange', { method: 'POST', body: { code, state, verifier } });
    const data = await res.json();
    this.session = { displayName: data.displayName, expiresAt: data.expiresAt, bearer: data.bearer };
    this.saveSession();
    sessionStorage.removeItem('paykr-oauth');
    return data;
  }

  logout() {
    this.session = null;
    this.saveSession();
    sessionStorage.removeItem('paykr-oauth');
  }

  // --- reviews ------------------------------------------------------------
  async summaries(placeIds) {
    const ids = [...new Set((placeIds || []).filter(Boolean).map(String))];
    if (!ids.length) return {};
    if (this.useMock) {
      const out = {};
      for (const id of ids) out[id] = this.mockSummary(id);
      return out;
    }
    const res = await this.request('/api/review-summaries', { method: 'POST', body: { placeIds: ids } });
    return res.json();
  }

  mockSummary(placeId) {
    const rows = mock.reviews.get(placeId) || [];
    const latest = new Map(); // authorKey -> latest valid report
    for (const row of rows) {
      if (row.paymentStatus === 'unspecified') continue;
      const prev = latest.get(row.authorKey);
      if (!prev || new Date(row.createdAt) > new Date(prev.createdAt)) latest.set(row.authorKey, row);
    }
    let success = 0,
      fail = 0,
      latestAt = null;
    for (const row of latest.values()) {
      if (row.paymentStatus === 'available') success++;
      else if (row.paymentStatus === 'unavailable') fail++;
      if (!latestAt || row.createdAt > latestAt) latestAt = row.createdAt;
    }
    return { success, fail, latestAt, complete: true };
  }

  async list(placeId, cursor) {
    if (this.useMock) {
      const rows = (mock.reviews.get(String(placeId)) || []).slice().reverse();
      return { items: rows.map(publicReview), cursor: null, complete: true };
    }
    const params = new URLSearchParams({ placeId: String(placeId) });
    if (cursor) params.set('cursor', cursor);
    const res = await this.request('/api/reviews?' + params.toString());
    return res.json();
  }

  async submit(payload) {
    if (!this.session) throw new ReviewsError('AUTH_REQUIRED', 401);
    if (this.useMock) {
      const row = {
        messageId: mock.nextId(),
        provider: 'kakao',
        placeId: String(payload.placeId || ''),
        placeName: String(payload.placeName || ''),
        paymentStatus: PAYMENT_STATUS.includes(payload.paymentStatus) ? payload.paymentStatus : 'unspecified',
        content: String(payload.content || '').slice(0, 500),
        displayName: this.session.displayName,
        authorKey: 'hmac:' + this.session.bearer,
        clientRequestId: payload.clientRequestId || randomToken(16),
        createdAt: new Date().toISOString(),
      };
      if (!mock.reviews.has(row.placeId)) mock.reviews.set(row.placeId, []);
      mock.reviews.get(row.placeId).push(row);
      return publicReview(row);
    }
    const res = await this.request('/api/reviews', { method: 'POST', auth: true, body: payload });
    return res.json();
  }

  async remove(messageId) {
    if (!this.session) throw new ReviewsError('AUTH_REQUIRED', 401);
    if (this.useMock) {
      for (const rows of mock.reviews.values()) {
        const i = rows.findIndex((r) => r.messageId === messageId);
        if (i !== -1) rows.splice(i, 1);
      }
      return { ok: true };
    }
    const res = await this.request('/api/reviews/' + encodeURIComponent(messageId), { method: 'DELETE', auth: true });
    return res.json();
  }

  async report(messageId, reason) {
    if (!this.session) throw new ReviewsError('AUTH_REQUIRED', 401);
    if (this.useMock) return { ok: true };
    const res = await this.request('/api/reviews/' + encodeURIComponent(messageId) + '/report', {
      method: 'POST',
      auth: true,
      body: { reason },
    });
    return res.json();
  }

  async request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { Accept: 'application/json' };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    if (auth && this.session) headers.Authorization = 'Bearer ' + this.session.bearer;
    const res = await fetch(this.config.apiBase + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      let code = 'HTTP_' + res.status;
      try {
        code = (await res.json()).code || code;
      } catch {
        /* fall through */
      }
      throw new ReviewsError(code, res.status);
    }
    return res;
  }
}

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as tick } from 'node:timers/promises';
import { SearchService, keywordFor, acquirePosition } from '../src/services/search.js';
import { placeText } from '../place-text.js';
import { paymentFor, placeRecord, legacyClaim } from '../src/models/payment.js';
import { CatalogRepository } from '../src/repositories/catalog.js';

const rows = JSON.parse(await readFile(new URL('../src/data/stores.json', import.meta.url)));
const catalog = new CatalogRepository(async () => rows);
assert.equal(rows.length, 160);
assert.equal(
  rows.reduce((n, r) => n + r.categories.length, 0),
  163,
);
assert.equal(new Set(rows.flatMap((r) => r.categories)).size, 11);
for (const [input, want] of [
  ['star bucks', '스타벅스'],
  ['オリーブヤング', '올리브영'],
  ['星巴克', '스타벅스'],
  ['明洞', '명동'],
  ['Ｍｙｅｏｎｇ－ｄｏｎｇ', '명동'],
  ['Seoul', '서울'],
])
  assert.equal(keywordFor(input, rows), want);
assert.equal(placeText.name('스타벅스 강남역점'), 'Starbucks Gangnam Station Branch');
assert.equal(placeText.address('서울 강남구 테헤란로 123'), '123, Teheran-ro, Gangnam-gu, Seoul');
assert.equal(placeRecord({ id: '1', place_name: 'X', x: 'NaN', y: '37' }), null);
let calls = 0,
  active = 0,
  peak = 0;
const provider = {
  async search(keyword, bounds, page) {
    calls++;
    peak = Math.max(peak, ++active);
    await tick();
    active--;
    if (keyword === 'CU') throw Error('provider failure');
    return { rows: [{ id: '1', place_name: 'GS25 명동점', x: '127', y: '37' }], more: page === 1 };
  },
};
const service = new SearchService(provider, catalog);
const first = await service.search({ bounds: [36, 126, 38, 128] });
assert.equal(calls, 12);
assert.equal(peak, 4);
assert(first.more && first.limited);
assert.equal(first.errors, 1);
assert.equal(first.items.length, 1);
assert.equal(first.items[0].claim.status, 'brand_listed');
const free = await service.search({ input: 'GS25' });
assert.equal(free.items[0].claim.status, 'unknown');
assert(free.more);
assert(!(await service.search({ input: 'GS25', page: 2 })).more);
let release;
const delayed = new SearchService(
  {
    search: () =>
      new Promise((res) => {
        release = res;
      }),
  },
  catalog,
);
const a = delayed.search({ input: 'CU' });
await tick();
const b = delayed.search({ input: 'CU' });
await tick();
release({ rows: [], more: false });
assert.equal(await a, null);
assert.deepEqual((await b).items, []);
const base = legacyClaim('store-1', 'in_store');
const claim = {
  ...base,
  placeId: '1',
  status: 'verified',
  evidence: [{ scope: 'branch', sourceType: 'operator', observedAt: '2026-11-01' }],
};
assert.equal(paymentFor('1', null, [claim]).status, 'verified');
assert.equal(paymentFor('2', null, [claim]).status, 'unknown');
assert.equal(paymentFor('1', null, [claim], 'app').status, 'unknown');
assert.equal(paymentFor('1', null, [claim, { ...claim, status: 'not_supported' }]).status, 'conflict');
for (const [error, want] of [
  [1, 'location.denied'],
  [2, 'location.unavailable'],
  [3, 'location.timeout'],
]) {
  await assert.rejects(
    acquirePosition({ getCurrentPosition: (ok, fail) => fail({ code: error }) }),
    (reason) => reason === want,
  );
}
await assert.rejects(
  acquirePosition({ getCurrentPosition: (ok) => ok({ coords: { latitude: 40.7, longitude: -74 } }) }),
  (r) => r === 'location.outside',
);
assert.deepEqual(
  await acquirePosition({ getCurrentPosition: (ok) => ok({ coords: { latitude: 37.5, longitude: 127 } }) }),
  { lat: 37.5, lng: 127 },
);
assert.match(
  await readFile(new URL('../forum/index.html', import.meta.url), 'utf8'),
  /index.html\?chat=open/,
);
console.log(
  'PASS: 163 category memberships, alias normalization, place formatting, bounded concurrent searches, pagination, coalescing, stale results, evidence conflicts and location states',
);

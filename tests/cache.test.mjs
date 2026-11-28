import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CatalogRepository } from '../src/repositories/catalog.js';
import { MemoryCache } from '../src/infrastructure/cache/memory.js';
import { CatalogStore } from '../src/infrastructure/cache/catalog-store.js';

const data = JSON.parse(await readFile(new URL('../src/data/online.json', import.meta.url)));
let now = 0;
const cache = new MemoryCache(2, 10, () => now);
cache.set('a', 1);
cache.set('b', 2);
cache.get('a');
cache.set('c', 3);
assert.equal(cache.get('b'), undefined);
now = 10;
assert.equal(cache.get('a'), undefined);
let persisted,
  dirty = 0;
const storage = {
  async write(_, v) {
    persisted = structuredClone(v);
  },
  async read() {
    return structuredClone(persisted);
  },
  async clear() {
    persisted = null;
  },
};
const repo = new CatalogRepository(async () => data, storage, { clock: () => now, notify: () => dirty++ });
const [a, b] = await Promise.all([repo.query('online'), repo.query('online')]);
assert.equal(a[0], b[0]);
assert.equal(repo.metrics.source, 1);
assert.equal(repo.metrics.merged, 1);
await repo.query('online', 'all', 'very private search');
assert(!JSON.stringify(persisted).includes('very private search'));
const revisit = new CatalogRepository(async () => data, storage, { clock: () => now });
await revisit.query('online');
assert.equal(revisit.metrics.l2, 1);
assert.equal(revisit.metrics.source, 0);
now += 86400000;
await revisit.query('online');
assert.equal(revisit.metrics.source, 1);
persisted.version = 'old';
revisit.invalidate();
await revisit.query('online');
assert.equal(revisit.metrics.source, 2);
persisted.groups = { bad: true };
revisit.invalidate();
await revisit.query('online');
assert.equal(revisit.metrics.source, 3);
const denied = {
  read() {
    throw Error();
  },
  write() {
    throw Error();
  },
  clear() {
    throw Error();
  },
};
const restricted = new CatalogRepository(async () => data, denied);
assert.equal((await restricted.query('online')).length, 37);
await assert.rejects(restricted.clear());
await assert.rejects(repo.query('kakao'));
assert.throws(() => new CatalogStore(null, '/PayKR/').write('provider', {}));
await repo.clear();
assert.equal(persisted, null);
assert.equal(dirty, 1);
let finish;
const pending = new CatalogRepository(
  () =>
    new Promise((resolve) => {
      finish = resolve;
    }),
  storage,
);
const stale = pending.query('online');
await new Promise(setImmediate);
await pending.clear();
finish(data);
await stale;
assert.equal(persisted, null);
assert.equal(pending.entities.size, 0);
console.log(
  'PASS: identity map, LRU, TTL boundary, query index, shared source reads, revisits, version invalidation, corrupt data, quota, clear and stale-write protection',
);

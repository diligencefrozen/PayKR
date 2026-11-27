import assert from 'node:assert/strict';
import { withBrowser } from './browser-env.mjs';

await withBrowser(async (browser, base) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const first = await context.newPage(),
    other = await context.newPage();
  await Promise.all([first.goto(base + 'guide.html'), other.goto(base + 'guide.html')]);
  await first.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('paykr-catalog:browser-qa', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('old-schema');
        req.onsuccess = () => {
          req.result.close();
          resolve();
        };
        req.onerror = reject;
      }),
  );
  for (const tab of [first, other])
    await tab.evaluate(async () => {
      const { CatalogStore, invalidations } = await import('./src/infrastructure/cache/catalog-store.js');
      const { CatalogRepository } = await import('./src/repositories/catalog.js');
      const { fetchCatalog } = await import('./src/infrastructure/providers/owned.js');
      window.store = new CatalogStore(indexedDB, 'browser-qa');
      window.repo = new CatalogRepository(fetchCatalog, store);
      repo.notify = invalidations('browser-qa', () => repo.invalidate());
      await repo.query('stores');
    });
  assert.deepEqual(await first.evaluate(async () => [...(await store.open()).objectStoreNames]), [
    'snapshots',
  ]);
  assert.equal(await other.evaluate(() => repo.metrics.l2), 1);
  await other.evaluate(async () => {
    window.oldRead = await store.readSnapshot('stores');
  });
  await first.evaluate(() => repo.clear());
  await other.waitForFunction(() => repo.entities.size === 0);
  await other.evaluate(() => store.write('stores', oldRead.record, oldRead.epoch));
  assert.equal(await first.evaluate(() => store.read('stores')), undefined);
  await other.evaluate(() => repo.query('stores', 'all', 'private customer text'));
  const record = await first.evaluate(() => store.read('stores'));
  assert.equal(record.rows.length, 160);
  assert(!JSON.stringify(record).includes('private customer text'));
  const fallback = await browser.newContext({ serviceWorkers: 'block' });
  await fallback.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw Error('Storage denied');
      },
    });
  });
  const limited = await fallback.newPage();
  await limited.goto(base + 'online.html?lang=ja');
  await limited.locator('#directory[data-ready]').waitFor();
  assert.equal(await limited.locator('.brand').count(), 36);
  await fallback.close();
  await context.close();
  console.log(
    'PASS: real IndexedDB schema upgrade, cross-tab snapshot reuse, broadcast invalidation, stale writer rejection, search privacy and disabled storage',
  );
});

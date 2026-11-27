import assert from 'node:assert/strict';
import { withBrowser } from './browser-env.mjs';
await withBrowser(async (browser, base) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  const page = await context.newPage();
  await page.goto(base + 'guide.html');
  const result = await page.evaluate(async () => {
    const { CatalogRepository } = await import('./src/repositories/catalog.js');
    const { CatalogStore } = await import('./src/infrastructure/cache/catalog-store.js');
    const storage = new CatalogStore(indexedDB, 'perf-test');
    const source = async () => {
      const response = await fetch('./src/data/stores.json', { cache: 'no-store' });
      return response.json();
    };
    const measurements = {};
    for (const mode of ['cold', 'warm', 'revisit']) {
      const times = [],
        metrics = { l1: 0, l2: 0, source: 0, merged: 0, query: 0 };
      const shared = new CatalogRepository(source, storage);
      await shared.query('stores');
      const before = { ...shared.metrics };
      for (let i = 0; i < 40; i++) {
        if (mode === 'cold') await storage.clear();
        const repo = mode === 'warm' ? shared : new CatalogRepository(source, storage);
        const begin = performance.now();
        await repo.query('stores', 'all', '스타벅스');
        times.push(performance.now() - begin);
        if (mode !== 'warm') for (const key of Object.keys(metrics)) metrics[key] += repo.metrics[key];
      }
      if (mode === 'warm')
        for (const key of Object.keys(metrics)) metrics[key] = shared.metrics[key] - before[key];
      times.sort((a, b) => a - b);
      measurements[mode] = { p50ms: times[19], p95ms: times[37], ...metrics };
    }
    const record = await storage.read('stores');
    measurements.snapshotBytes = new Blob([JSON.stringify(record)]).size;
    await storage.clear();
    const simultaneous = new CatalogRepository(source, storage);
    await Promise.all(Array.from({ length: 10 }, () => simultaneous.query('stores')));
    measurements.burst = simultaneous.metrics;
    await storage.clear();
    return measurements;
  });
  assert.equal(result.cold.source, 40);
  assert.equal(result.warm.source, 0);
  assert.equal(result.revisit.l2, 40);
  assert.equal(result.burst.merged, 9);
  console.log(JSON.stringify(result, null, 2));
  await context.close();
});

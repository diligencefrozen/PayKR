import { withBrowser } from './browser-env.mjs';
await withBrowser(async (browser, base) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
  });
  await context.route('**/*', (route) =>
    route.request().url().startsWith(base) ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.lab = { cls: 0, lcp: 0 };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.lab.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      window.lab.lcp = list.getEntries().at(-1).startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  for (let run = 1; run <= 3; run++) {
    await page.goto(base + 'online.html?lang=en&adpreview=1');
    await page.locator('.brand').first().waitFor();
    await page.waitForTimeout(400);
    const sample = await page.evaluate(() => ({
      ...window.lab,
      dom: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
      jsBytes: performance
        .getEntriesByType('resource')
        .filter((r) => new URL(r.name).pathname.endsWith('.js'))
        .reduce((sum, r) => sum + r.decodedBodySize, 0),
      heap: performance.memory?.usedJSHeapSize,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    console.log(JSON.stringify({ run, ...sample }));
  }
}, process.env.PAYKR_BASELINE_ROOT);

// Optional comparison with a separate, read-only checkout of the pre-2.0 site.
import assert from 'node:assert/strict';
import { withBrowser } from './browser-env.mjs';
const baseline = process.env.PAYKR_BASELINE_ROOT;
if (!baseline) throw Error('Set PAYKR_BASELINE_ROOT to the extracted baseline');
async function measurements(root) {
  let data = {};
  await withBrowser(async (browser, base) => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
    const tab = await context.newPage();
    for (const width of [390, 1280]) {
      await tab.setViewportSize({ width, height: 900 });
      for (const page of ['index', 'online']) {
        await tab.goto(base + page + '.html?lang=ko');
        if (page === 'index')
          await tab.waitForFunction(
            () => document.querySelectorAll('#desktop-categories button').length >= 14,
          );
        if (page === 'online' && !root) await tab.locator('#directory[data-ready]').waitFor();
        const selectors =
          page === 'index'
            ? [
                width === 390 ? '#search-box-mobile' : '#search-box',
                width === 390 ? '#mobile-categories' : '.desktop-category-wrapper',
                width === 390 ? '#place-sheet' : '#sidebar',
              ]
            : ['.brand-logo'];
        for (const selector of selectors) {
          const box = await tab.locator(selector).first().boundingBox();
          assert(box, selector);
          data[width + ' ' + selector] = Object.fromEntries(
            Object.entries(box).map(([k, v]) => [k, Math.round(v)]),
          );
        }
      }
    }
    await context.close();
  }, root);
  return data;
}
const before = await measurements(baseline),
  after = await measurements();
for (const key of Object.keys(before)) {
  const a = before[key],
    b = after[key];
  // Additional notes/actions can extend content vertically. Anchor edges and column widths remain stable.
  console.log(key, JSON.stringify(a), JSON.stringify(b));
  // Directory columns now fill the explorer panel. Logo height still follows the original scale.
  if (!key.includes('brand-logo'))
    assert(Math.abs(a.x - b.x) <= 1 && Math.abs(a.width - b.width) <= 1, key + ' horizontal geometry');
  if (
    key.includes('search-box') ||
    key.includes('desktop-category') ||
    key.includes('brand-logo')
  )
    assert(Math.abs(a.height - b.height) <= 1, key + ' control height');
}

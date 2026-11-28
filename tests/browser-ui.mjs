import assert from 'node:assert/strict';
import { withBrowser } from './browser-env.mjs';

// Only injected into the test browser. The shipped app has no demo place records.
function kakaoFixture() {
  window.fixture = { calls: [], maps: 0, markers: [], gps: [], crates: [] };
  const f = window.fixture;
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition: (ok, fail) => f.gps.push({ ok, fail }) },
  });
  class Point {
    constructor(lat, lng) {
      this.lat = lat;
      this.lng = lng;
    }
    getLat() {
      return this.lat;
    }
    getLng() {
      return this.lng;
    }
  }
  class Bounds {
    constructor(sw, ne) {
      this.sw = sw;
      this.ne = ne;
    }
    getSouthWest() {
      return this.sw;
    }
    getNorthEast() {
      return this.ne;
    }
  }
  class MapView {
    constructor(_, options) {
      this.setCenter(options.center);
      this.level = options.level;
      f.maps++;
      f.map = this;
    }
    setCopyrightPosition(position) { this.copyright = position; }
    setCenter(p) {
      this.center = p;
    }
    getBounds() {
      return new Bounds(this.center, new Point(this.center.lat + 0.02, this.center.lng + 0.02));
    }
    getLevel() {
      return this.level;
    }
    setLevel(n) {
      this.events?.zoom_start?.();
      this.level = n;
    }
    relayout() {}
  }
  class Marker {
    constructor(o) {
      Object.assign(this, o);
      f.markers.push(this);
    }
    setMap(m) {
      this.map = m;
    }
    getPosition() {
      return this.position;
    }
  }
  class Places {
    keywordSearch(keyword, cb, options) {
      f.calls.push({ keyword, page: options.page, bounded: !!options.bounds });
      const store = {
        id: '123',
        place_name: '스타벅스 강남역점',
        x: '127',
        y: '37.55',
        road_address_name: '서울 강남구 테헤란로 123',
        category_name: '음식점 > 카페',
        phone: '02-123-4567',
      };
      const rows =
        keyword === '없는곳'
          ? []
          : keyword === 'unsafe'
            ? [{ ...store, place_name: '<img src=x onerror=alert(1)>' }]
            : [store];
      setTimeout(
        () =>
          cb(rows, keyword === 'apierror' ? 'ERROR' : rows.length ? 'OK' : 'ZERO_RESULT', {
            hasNextPage: options.page === 1,
          }),
        3,
      );
    }
  }
  window.kakao = {
    maps: {
      load: (fn) => fn(),
      Map: MapView,
      CopyrightPosition: { BOTTOMRIGHT: 'bottomright' },
      LatLng: Point,
      LatLngBounds: Bounds,
      Marker,
      Size: Point,
      MarkerImage: class {constructor(url){this.url=url;}},
      CustomOverlay: Marker,
      services: { Places, Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT' } },
      event: { addListener: (o, n, fn) => ((o.events ||= {})[n] = fn) },
    },
  };
  window.Crate = class {
    constructor(o) {
      this.options = o;
      f.crates.push(this);
    }
    show() {}
    toggle(value) {
      this.open = value;
    }
  };
}

await withBrowser(async (browser, base) => {
  // Pass a local copy of the pinned CDN bundle to exercise Crate's own X button.
  if (process.env.PAYKR_WIDGETBOT_JS) {
    const chatContext = await browser.newContext({serviceWorkers: 'block'});
    await chatContext.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(base)) return route.continue();
      if (url === 'https://cdn.jsdelivr.net/npm/@widgetbot/crate@3.9.1')
        return route.fulfill({path: process.env.PAYKR_WIDGETBOT_JS, contentType: 'application/javascript'});
      return route.abort();
    });
    const chatPage = await chatContext.newPage();
    for (const [entry, width] of [['index.ko.html', 390], ['online.ko.html', 1280], ['forum/', 390]]) {
      await chatPage.setViewportSize({width, height: 844});
      await chatPage.goto(base + entry);
      const widgetButton = chatPage.locator('widgetbot-crate .button');
      for (let visit = 0; visit < 2; visit++) {
        if (entry !== 'forum/' || visit > 0) {
          await chatPage.locator('#feedback-open').click();
          await chatPage.locator('#open-discord').click();
        }
        await widgetButton.click();
        await widgetButton.waitFor({state: 'hidden', timeout: 3000});
        assert(await chatPage.locator('#feedback-open').isVisible());
      }
      assert.equal(await widgetButton.count(), 1);
    }
    await chatContext.close();
    console.log('PASS: actual WidgetBot close button hides the legacy launcher; map, directory and forum can reopen the same chat');
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
  });
  await context.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  await context.addInitScript(kakaoFixture);
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '?lang=en');
  await page.waitForFunction(()=>fixture.maps===1);
  assert.equal(await page.evaluate(() => fixture.maps), 1);
  await page.waitForFunction(() => fixture.gps.length === 1);
  assert.equal(await page.evaluate(() => fixture.map.center.lat), 37.34487430629196);
  assert.equal(await page.evaluate(() => fixture.calls.length), 0);
  assert(await page.locator('#area').isVisible());
  assert.equal(await page.locator('#city, #evidence-filter').count(), 0);
  await page.evaluate(() => fixture.gps[0].ok({coords: {latitude: 37.5665, longitude: 126.978}}));
  await page.waitForFunction(() => fixture.map.center.lat === 37.5665);
  const expected = await page.evaluate(async () => (await (await fetch('./src/data/stores.json')).json()).map(row => row.names.ko));
  await page.waitForFunction(names => names.every(name => fixture.calls.some(call => call.keyword === name && call.page === 2)), expected);
  await page.evaluate(() => fixture.map.setLevel(6));
  await page.locator('#mobile-categories [data-category="all"]').click();
  assert.equal(await page.evaluate(() => fixture.map.level), 6);
  await page.waitForFunction(() => fixture.map.center.lat === 37.5665);
  await page.locator('#results .search-result-item').first().waitFor();
  await page.evaluate(() => fixture.markers.findLast(marker => marker.map && marker.events?.click).events.click());
  await page.locator('#marker-dialog[open] h2').waitFor();
  assert.equal((await page.locator('#marker-dialog').boundingBox()).height, 844);
  assert(await page.locator('#marker-detail a[href="https://place.map.kakao.com/123"]').isVisible());
  await page.locator('#marker-dialog form button').click();
  assert(await page.locator('#marker-dialog').isHidden());
  await page.locator('#source-switch').click();
  await page.locator('#results .badge.brand_listed').first().waitFor();
  assert.match(await page.locator('#place-title').innerText(), /brand directory/i);
  await page.locator('#source-switch').click();
  await page.locator('#results [data-id="123"]').waitFor();
  await page.locator('#location-button').click();
  await page.waitForFunction(() => fixture.gps.length === 2);
  await page.evaluate(() => fixture.gps[1].fail({code: 1}));
  await page.waitForFunction(() => !document.querySelector('#location-button').disabled);
  assert.equal(await page.evaluate(() => fixture.map.center.lat), 37.5665);
  await page.locator('#location-button').click();
  await page.waitForFunction(() => fixture.gps.length === 3);
  await page.locator('#search-input-mobile').fill('Starbucks');
  await page.locator('#search-input-mobile').press('Enter');
  await page.waitForFunction(() => fixture.calls.some((c) => c.keyword === '스타벅스'));
  await page.locator('.search-result-item[data-id="123"]').click();
  await page.waitForFunction(() => document.querySelector('#detail h2')?.textContent.includes('Starbucks'));
  assert.match(await page.locator('#detail').innerText(), /Not yet confirmed/);
  assert.equal(
    await page.getByRole('link', { name: 'Directions', exact: true }).getAttribute('href'),
    'https://map.kakao.com/link/to/123',
  );
  await page.evaluate(() => fixture.gps[2].ok({ coords: { latitude: 37.5665, longitude: 126.978 } }));
  assert.equal(await page.evaluate(() => fixture.map.center.lat), 37.55);
  await page.locator('[data-locale]:visible').selectOption('ko');
  await page.waitForFunction(() => document.documentElement.lang === 'ko');
  assert.match(await page.locator('#detail').innerText(), /테헤란로 123/);
  if (process.argv.includes('--screenshots'))
    await page.screenshot({path:'ss/paykr2-place-390-ko-fixture.png'});
  await page.setViewportSize({width:1280,height:900});
  await page.locator('#sidebar #detail').waitFor();
  if (process.argv.includes('--screenshots'))
    await page.screenshot({path:'ss/paykr2-place-1280-ko-fixture.png'});
  await page.locator('#place-clear').click();
  await page.evaluate(() => fixture.markers.findLast(marker => marker.map && marker.events?.click).events.click());
  await page.locator('#sidebar #detail .badge').waitFor();
  assert.equal(await page.locator('#detail .evidence').count(), 0);
  await page.locator('#zoom-in').click();
  assert.equal(await page.evaluate(() => fixture.map.level), 5);
  await page.setViewportSize({width:390,height:844});
  await page.locator('#feedback-open').click();
  await page.locator('#open-discord').click();
  assert.equal(await page.evaluate(() => fixture.crates.length), 1);
  assert.equal(await page.evaluate(() => fixture.crates[0].options.channel), '1574706454353412239');
  assert(await page.locator('#detail').isVisible());
  await page.locator('#feedback-open').click();
  await page.locator('#open-discord').click();
  assert.equal(await page.evaluate(() => fixture.crates.length), 1);
  await page.locator('#search-input-mobile').fill('unsafe');
  await page.locator('#search-input-mobile').press('Enter');
  await page.locator('.search-result-item').filter({ hasText: '<img' }).first().waitFor();
  assert.equal(await page.locator('#results img[src="x"]').count(), 0);
  await page.evaluate(()=>fixture.map.events.dragstart());
  await page.locator('#area').click();
  await page.waitForFunction(() => fixture.calls.at(-1).bounded);
  await page.locator('#sheet-toggle').click();
  assert.equal(await page.locator('#sheet-toggle').getAttribute('aria-expanded'), 'false');
  await page.locator('#sheet-toggle').click();
  await page.locator('.filter-toggle:visible').click();
  await page.locator('#filter-categories [data-category="편의점&카페"]').click();
  await page.locator('.search-result-item[data-id]').first().waitFor();
  await page.evaluate(() => fixture.map.events.dragstart());
  assert.match(await page.locator('#place-subtitle').innerText(), /지도|지역/);
  await page.locator('#search-input-mobile').fill('없는곳');
  await page.locator('#search-input-mobile').press('Enter');
  await page.waitForFunction(
    () =>
      !document.querySelector('.search-result-item') &&
      document.querySelector('#map-status').textContent.includes('없'),
  );
  await page.locator('#search-input-mobile').fill('apierror');
  await page.locator('#search-input-mobile').press('Enter');
  await page.waitForFunction(() => document.querySelector('#map-status').textContent.includes('다시'));
  await page.goto(base + 'online.html?lang=en&adpreview=1');
  await page.locator('#directory[data-ready]').waitFor();
  assert.equal(await page.locator('.brand').count(), 37);
  assert.equal(
    await page
      .locator('[data-slot="directory-middle"]')
      .evaluate((n) => n.previousElementSibling.querySelectorAll('.brand').length),
    8,
  );
  await page.locator('#searchInput').fill('cOsT co');
  await page.waitForFunction(() => document.querySelectorAll('.brand').length === 1);
  assert.match(await page.locator('.brand').innerText(), /Costco/);
  assert(await page.locator('[data-slot="directory-middle"]').isHidden());
  await page.locator('[data-category="travel"]').click();
  await page.locator('#empty').waitFor();
  await page.locator('#reset').click();
  await page.waitForFunction(() => document.querySelectorAll('.brand').length === 37);
  assert.deepEqual(errors, []);
  await context.close();
  const fallback = await browser.newContext({ serviceWorkers: 'block' });
  await fallback.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  const view = await fallback.newPage();
  view.on('pageerror', (e) => errors.push(e.message));
  await view.goto(base + 'forum/');
  await view.locator('#discord-fallback').waitFor();
  await view.locator('#feedback-dialog form button').click();
  for (const [width, height, lang, scheme] of [
    [320, 640, 'zh-Hans', 'light'],
    [320, 640, 'en', 'light'],
    [390, 844, 'en', 'light'],
    [390, 844, 'ko', 'light'],
    [430, 932, 'ja', 'dark'],
    [390, 844, 'ar', 'dark'],
    [1280, 900, 'ru', 'light'],
    [768, 1024, 'zh-Hant', 'light'],
    [1280, 800, 'ko', 'dark'],
    [1280, 800, 'en', 'light'],
    [1280, 900, 'ko', 'light'],
    [1280, 900, 'ja', 'light'],
    [1280, 900, 'zh-Hans', 'light'],
    [1280, 900, 'zh-Hant', 'light'],
    [630, 320, 'ko', 'light'],
  ]) {
    await view.setViewportSize({ width, height });
    await view.emulateMedia({ colorScheme: scheme });
    await view.goto(base + '?lang=' + lang);
    await view.locator('#map-failure').waitFor();
    const mobile = width <= 768;
    const nav = view.locator(mobile ? '.bottom-nav' : '.top-nav');
    assert(await nav.isVisible());
    assert.equal(await nav.locator('a, button').count(), 4);
    assert.equal(await nav.locator('[aria-current]').getAttribute('data-page'), './');
    assert.equal(await view.locator('#city').count(), 0);
    if (height > 500) await view.locator('#results .search-result-item').first().waitFor();
    for (const target of ['[data-locale]', '#retry-map', '#city-map', '#feedback-open', ...(mobile ? ['.bottom-nav [data-more]'] : [])]) {
      assert(await view.locator(target).evaluate(node => {
        const box = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      }), target + ' covered at ' + width + 'x' + height);
    }
    assert(await view.locator(width<=768?'#search-box-mobile':'#sidebar-header').isVisible());
    assert.equal(await view.evaluate(() => document.documentElement.lang), lang);
    assert(
      await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'overflow ' + width,
    );
    if (process.argv.includes('--screenshots'))
      await view.screenshot({ path: 'ss/paykr2-' + width + '-' + lang + '-' + scheme + '.png' });
  }
  await view.setViewportSize({width:390,height:844});
  await view.addInitScript(() => Object.defineProperty(navigator, 'install', {
    configurable: true, value: async () => { window.installActivated = navigator.userActivation.isActive; },
  }));
  await view.goto(base+'?lang=ko');
  await view.locator('.search-result-item').first().click();
  assert.equal(await view.locator('#detail .badge').innerText(), '매장에서 직접 확인하세요');
  assert.equal(await view.locator('#detail .evidence').count(), 0);
  await view.locator('#sheet-toggle').click();
  await view.locator('#sheet-toggle').click();
  assert(await view.locator('#detail .badge').isVisible());
  await view.setViewportSize({width:1280,height:900});
  await view.locator('#sidebar #detail .badge').waitFor();
  const sidebar = view.locator('#sidebar-content');
  const detail = view.locator('#place-sheet');
  const listBounds = await sidebar.boundingBox(), detailBounds = await detail.boundingBox();
  assert(listBounds.x+listBounds.width <= detailBounds.x, 'detail must be beside list');
  assert(Math.abs(listBounds.y-detailBounds.y)<=2, 'panels must align');
  assert(await view.locator('#results .search-result-item').first().isVisible());
  assert.equal(await detail.evaluate(node=>node.parentElement.id),'sidebar');
  assert.equal(await view.locator('#sheet-content').evaluate(node=>getComputedStyle(node).overflowY),'auto');
  await view.locator('#place-clear').click();
  await view.setViewportSize({width:390,height:844});
  await view.locator('#feedback-open').click();
  for (const form of ['merchant','bug','feature','translation'])
    assert(await view.locator('#issue-links a[href$="template=' + form + '.yml"]').isVisible());
  if (process.argv.includes('--screenshots'))
    await view.screenshot({path:'ss/paykr2-feedback-390-ko.png'});
  await view.keyboard.press('Escape');
  assert(await view.locator('#feedback-open').evaluate(node => node === document.activeElement));
  await view.locator('.bottom-nav [data-more]').click();
  await view.locator('#settings [data-notes="releases"]').click();
  await view.locator('#release-archive time').first().waitFor();
  assert(await view.locator('#release-archive p[lang="ko"]').count() > 30);
  await view.keyboard.press('Escape');
  await view.locator('#settings [data-install]').click();
  assert(await view.evaluate(() => window.installActivated));
  assert(await view.locator('.header-install').isHidden());
  await view.locator('.bottom-nav [data-page="./guide.html"]').click();
  await view.locator('#phrases').waitFor();
  assert.equal(await view.locator('html').getAttribute('lang'), 'ko');
  await view.locator('.bottom-nav [data-page="./online.html"]').click();
  await view.locator('#directory[data-ready]').waitFor();
  for (const [width, height] of [[390,844], [1280,900], [769,900], [320,640]]) {
    await view.setViewportSize({width,height});
    const nav = width <= 768 ? '.bottom-nav' : '.top-nav';
    const search = view.locator('.explore-search:visible');
    const directoryBox = await search.boundingBox();
    const header = await view.locator('.masthead').boundingBox();
    if (width > 768)
      assert(await view.evaluate(() => document.querySelector('.top-nav').getBoundingClientRect().right <= document.querySelector('.header-actions').getBoundingClientRect().left));
    assert.equal(await view.locator(nav + ' [aria-current]').getAttribute('data-page'), './online.html');
    assert.equal(await view.locator('#directory-filters button svg').count(), 6);
    assert.equal(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.argv.includes('--screenshots') && [390,1280].includes(width))
      await view.screenshot({path:'ss/paykr2-directory-' + width + '-ko.png'});
    if (width === 320) {
      await view.locator('#directory-filter-toggle').click();
      assert.equal(await view.locator('#directory-filter-toggle').getAttribute('aria-expanded'), 'true');
      await view.locator('#directory-filters [data-category="convenience"]').click();
      await view.waitForFunction(() => document.querySelectorAll('.brand').length < 37);
      assert.equal(await view.locator('#directory-filter-toggle').getAttribute('aria-expanded'), 'false');
      await view.locator('#directory-filter-toggle').click();
      await view.locator('#directory-filters [data-category="all"]').click();
      await view.waitForFunction(() => document.querySelectorAll('.brand').length === 37);
      await view.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await view.locator('#searchInput').fill('Costco');
      await view.waitForFunction(() => document.querySelectorAll('.brand').length === 1 && window.scrollY === 0);
    }
    await view.locator(nav + ' [data-page="./"]').click();
    await view.locator('#map-failure').waitFor();
    assert.deepEqual(await view.locator('.masthead').boundingBox(), header);
    const mapBox = await view.locator('#map').boundingBox();
    assert.equal(mapBox.x, 0);
    assert.equal(mapBox.y, 0);
    assert.equal(mapBox.width, width);
    if (width > 768)
      assert(await view.evaluate(() => document.querySelector('.top-nav').getBoundingClientRect().right <= document.querySelector('.header-actions').getBoundingClientRect().left));
    assert.deepEqual(await search.boundingBox(), directoryBox, 'map/directory search position at ' + width);
    await view.locator(nav + ' [data-page="./online.html"]').click();
    await view.locator('#directory[data-ready]').waitFor();
  }
  await view.goto(base + 'guide.ja.html');
  await view.waitForFunction(() => document.documentElement.lang === 'ja');
  await view.locator('#phrases').waitFor();
  assert.deepEqual(errors, []);
  await fallback.close();
  console.log(
    'PASS: browser map SDK mock, late GPS, safe text, evidence, locale switching, map/list selection, sheet, category/filter, bounded area retry, singleton chat and directory filters; SDK/CDN failure, localized URLs, dark mode and responsive viewports',
  );
});

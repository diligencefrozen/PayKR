import { withBrowser } from '../tests/browser-env.mjs';

function kakaoFixture() {
  window.fixture = { calls: [], gps: [] };
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
    }
    setCopyrightPosition() {}
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
      this.level = n;
    }
    relayout() {}
  }
  class Marker {
    constructor(o) {
      Object.assign(this, o);
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
      f.calls.push({ keyword, page: options.page });
      const store = {
        id: '123',
        place_name: '스타벅스 강남역점',
        x: '127',
        y: '37.55',
        road_address_name: '서울 강남구 테헤란로 123',
        category_name: '음식점 > 카페',
        phone: '02-123-4567',
      };
      const rows = keyword === '없는곳' ? [] : [store];
      setTimeout(() => cb(rows, rows.length ? 'OK' : 'ZERO_RESULT', { hasNextPage: options.page === 1 }), 2);
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
      MarkerImage: class {
        constructor(url) {
          this.url = url;
        }
      },
      CustomOverlay: Marker,
      services: { Places, Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT' } },
      event: { addListener: (o, n, fn) => ((o.events ||= {})[n] = fn) },
    },
  };
}

await withBrowser(async (browser, base) => {
  // --- Kakao mode (fixture) ---
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  await context.addInitScript(kakaoFixture);
  const page = await context.newPage();
  await page.goto(base + 'index.ko.html?renderer=kakao');
  await page.waitForFunction(() => window.fixture !== undefined);
  await page.locator('#results .search-result-item').first().waitFor({ timeout: 20000 });
  await page.screenshot({ path: 'artifacts/screenshots/after/01-mobile-initial-390.png' });

  await page.locator('#results .search-result-item').first().click();
  await page.waitForFunction(() => {
    const h2 = document.querySelector('#detail h2');
    return h2 && h2.textContent.length > 0;
  });
  await page.locator('#place-sheet').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/screenshots/after/02-mobile-detail-community-390.png' });

  // Auth dialog
  await page.locator('#account-button').click();
  await page.locator('#auth-dialog[open]').waitFor();
  await page.screenshot({ path: 'artifacts/screenshots/after/03-mobile-auth-dialog-390.png' });
  await page.locator('#auth-later').click();

  // Desktop light
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#sidebar #detail').waitFor();
  await page.screenshot({ path: 'artifacts/screenshots/after/04-desktop-detail-1280.png' });

  // Desktop list (clear selection)
  await page.locator('#place-clear').click();
  await page.locator('#results .search-result-item').first().waitFor();
  await page.screenshot({ path: 'artifacts/screenshots/after/05-desktop-results-1280.png' });

  // Tablet
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: 'artifacts/screenshots/after/06-tablet-768.png' });

  // Dark mode
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: 'artifacts/screenshots/after/07-mobile-dark-390.png' });
  await context.close();

  // --- adpreview (online + guide) ---
  const ad = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ad.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  const adPage = await ad.newPage();
  await adPage.goto(base + 'online.html?lang=ko&adpreview=1');
  await adPage.locator('#directory[data-ready]').waitFor();
  await adPage.screenshot({ path: 'artifacts/screenshots/after/08-online-adpreview-1280.png' });
  await adPage.setViewportSize({ width: 390, height: 844 });
  await adPage.screenshot({ path: 'artifacts/screenshots/after/09-online-adpreview-390.png' });
  await adPage.goto(base + 'guide.html?lang=ko&adpreview=1');
  await adPage.locator('#phrases').waitFor();
  await adPage.screenshot({ path: 'artifacts/screenshots/after/10-guide-adpreview-1280.png' });
  await ad.close();

  // --- MapLibre experimental mode (allow external CDN + tiles) ---
  const ml = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mlPage = await ml.newPage();
  await mlPage.goto(base + 'index.html?lang=en&maplibre=1');
  await mlPage.waitForTimeout(4000);
  await mlPage.screenshot({ path: 'artifacts/screenshots/after/11-maplibre-1280.png' });
  await mlPage.setViewportSize({ width: 390, height: 844 });
  await mlPage.screenshot({ path: 'artifacts/screenshots/after/12-maplibre-390.png' });
  await ml.close();

  console.log('PASS: after screenshots captured to artifacts/screenshots/after/');
});

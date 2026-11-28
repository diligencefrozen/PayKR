import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { setImmediate as tick } from 'node:timers/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url));
const manifest = JSON.parse(await read('manifest.webmanifest'));
const base = 'https://example.test/PayKR/';
for (const key of ['id', 'scope', 'start_url']) assert.equal(new URL(manifest[key], base).href, base);
assert.equal(manifest.display, 'standalone');
for (const { src, sizes } of manifest.icons) {
  const buffer = await read(src);
  assert.equal(buffer.subarray(1, 4).toString(), 'PNG');
  assert.equal(buffer.readUInt32BE(16) + 'x' + buffer.readUInt32BE(20), sizes);
}
assert(manifest.icons.some((icon) => icon.purpose === 'maskable'));
assert.equal((await read('icons/apple-touch-icon.png')).readUInt32BE(16), 180);

// Run the production service worker in a worker-like realm with the Pages scope.
const handlers = {};
const deleted = [];
const precached = [];
const html = '<h1>PayKR</h1>';
async function integrity(body) {
  const bytes = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  return 'sha256-' + Buffer.from(bytes).toString('base64');
}
const hashes = [
  ['index.html', await integrity(html)],
  ['guide.html', await integrity('guide')],
  ['src/i18n/ko.js', await integrity('ko')],
];
const store = new Map(hashes.map(([path]) => [base + path, new Response('cached ' + path)]));
let skipCalls = 0,
  claims = 0,
  updates = 0;
let network = () => Promise.reject(new Error('offline'));
const self = {
  PAYKR_RELEASE: 'v2',
  PAYKR_SHELL: hashes,
  registration: {
    scope: base,
    update: async () => {
      updates++;
    },
  },
  location: new URL(base),
  clients: {
    claim: async () => {
      claims++;
    },
  },
  addEventListener: (name, handler) => {
    handlers[name] = handler;
  },
  skipWaiting: async () => {
    skipCalls++;
  },
};
const cache = {
  addAll: async (requests) => {
    precached.push(...requests);
  },
  match: async (key) => store.get(key)?.clone(),
};
const caches = {
  open: async () => cache,
  keys: async () => [
    'paykr-shell:/PayKR/:v1',
    'paykr-shell:/PayKR/:v2',
    'paykr-shell:/Else/:v1',
    'unrelated',
  ],
  delete: async (key) => {
    deleted.push(key);
  },
};
vm.runInNewContext((await read('sw.js')).toString(), {
  self,
  caches,
  importScripts() {},
  URL,
  Request,
  Response,
  Uint8Array,
  btoa,
  crypto: webcrypto,
  fetch: (request) => network(request),
});

async function run(name, payload = {}) {
  let pending;
  handlers[name]({
    ...payload,
    waitUntil: (value) => {
      pending = value;
    },
    respondWith: (value) => {
      pending = value;
    },
  });
  return pending;
}
function request(path, mode = 'cors', method = 'GET', headers = {}) {
  return run('fetch', {
    request: { url: new URL(path, base).href, mode, method, headers: new Headers(headers) },
  });
}
await run('install');
assert.equal(precached.length, hashes.length);
assert(
  precached.every(
    (request) => request.url.startsWith(base) && request.integrity && request.credentials === 'omit',
  ),
);
assert.equal(skipCalls, 0);
await run('activate');
assert.deepEqual(deleted, ['paykr-shell:/PayKR/:v1']);
assert.equal(claims, 1);
await run('message', { data: { type: 'other' } });
assert.equal(skipCalls, 0);
await run('message', { data: { type: 'paykr:activate' } });
assert.equal(skipCalls, 1);
for (const url of [
  'https://dapi.kakao.com/v2/maps/sdk.js',
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
  'https://cdn.jsdelivr.net/npm/@widgetbot/crate@3.9.1',
  'https://fundingchoicesmessages.google.com/i/pub',
  'forum/oauth-worker',
  '../index.html',
  'ads.txt',
  'src/i18n/ko.js?lat=37.5',
]) {
  assert.equal(await request(url), undefined);
  assert.equal(await request(url, 'navigate'), undefined);
}
assert.equal(await request('src/i18n/ko.js', 'cors', 'POST'), undefined);
assert.equal(await request('src/i18n/ko.js', 'cors', 'GET', { range: 'bytes=0-99' }), undefined);
assert.equal(await (await request('?q=private&lang=ko', 'navigate')).text(), 'cached index.html');
assert.equal(await (await request('guide.html?lang=ja', 'navigate')).text(), 'cached guide.html');
assert.equal(await (await request('src/i18n/ko.js?v=release')).text(), 'cached src/i18n/ko.js');
network = async () => new Response(html);
assert.equal(await (await request('index.html', 'navigate')).text(), html);
network = async () => new Response('new deployment');
assert.equal(await (await request('index.html', 'navigate')).text(), 'cached index.html');
assert.equal(updates, 1);

// Exercise the DOM entry points with browser events, including an early prompt.
class Element extends EventTarget {
  dataset = {};
  children = [];
  append(...children) {
    this.children.push(...children);
  }
  appendChild(child) {
    this.append(child);
    return child;
  }
  setAttribute() {}
  focus() {
    this.focused = true;
  }
  getClientRects() {
    return [1];
  }
  click() {
    this.dispatchEvent(new Event('click'));
  }
}
let session = 0;
async function browser({ standalone = false, storageDenied = false, ios = false, install } = {}) {
  const panel = new Element(),
    menu = new Element(), iosGuide = new Element(),
    display = new EventTarget();
  const storage = new Map();
  const doc = Object.assign(new EventTarget(), {
    head: new Element(),
    body: new Element(),
    querySelector: selector => selector === '[data-install-help]' ? iosGuide : selector === '[data-pwa-panel]' ? panel : null,
    querySelectorAll: () => [menu],
    createElement: () => new Element(),
  });
  display.matches = standalone;
  const win = Object.assign(new EventTarget(), { matchMedia: () => display, isSecureContext: true });
  const registration = new EventTarget();
  const worker = Object.assign(new EventTarget(), {
    controller: {},
    register: async (url, { scope }) => {
      assert.equal(new URL('sw.js', scope).href, url.href);
      return registration;
    },
  });
  const nav = { serviceWorker: worker, onLine: true, userAgent: ios ? 'iPhone' : 'Other', install };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: nav });
  let reloads = 0;
  Object.assign(globalThis, {
    window: win,
    document: doc,
    location: { reload: () => reloads++ },
    localStorage: {
      getItem: (key) => {
        if (storageDenied) throw Error();
        return storage.get(key);
      },
      setItem: (key, value) => {
        if (storageDenied) throw Error();
        storage.set(key, value);
      },
    },
  });
  const { initPwa } = await import('../src/infrastructure/pwa/install.js?test=' + ++session);
  function prompt(outcome) {
    let calls = 0;
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {
        calls++;
      },
      userChoice: Promise.resolve({ outcome }),
    });
    win.dispatchEvent(event);
    assert(event.defaultPrevented);
    return () => calls;
  }
  return {
    start: () => initPwa((key) => key),
    prompt,
    panel,
    menu,
    iosGuide,
    doc,
    win,
    nav,
    display,
    worker,
    registration,
    storage,
    reloads: () => reloads,
  };
}
let app = await browser();
const prompts = app.prompt('dismissed');
const { metrics } = app.start();
const [promo, help, update, offline] = app.panel.children;
assert(promo.hidden);
app.doc.dispatchEvent(new Event('paykr:explored'));
assert.equal(promo.hidden, false);
promo.children[1].click();
await tick();
assert.equal(prompts(), 1);
assert(promo.hidden);
assert(app.storage.size === 1);
assert.deepEqual(metrics, { impressions: 1, actions: 1, confirmed: 0 });
app.prompt('accepted');
assert(promo.hidden);
app.menu.click();
await tick();
assert.equal(metrics.confirmed, 0);
app.win.dispatchEvent(new Event('appinstalled'));
assert.equal(metrics.confirmed, 1);
assert(app.menu.hidden);
app.nav.onLine = false;
app.win.dispatchEvent(new Event('offline'));
assert.equal(offline.hidden, false);
app.nav.onLine = true;
app.win.dispatchEvent(new Event('online'));
assert(offline.hidden);
assert(help.hidden);

let activation;
app.registration.waiting = {
  state: 'installed',
  postMessage: (msg) => {
    activation = msg;
  },
};
app.registration.dispatchEvent(new Event('updatefound'));
assert.equal(update.hidden, false);
app.worker.dispatchEvent(new Event('controllerchange')); // Another tab accepted.
assert.equal(app.reloads(), 0);
app.registration.dispatchEvent(new Event('updatefound'));
update.children[1].click();
assert.deepEqual(activation, { type: 'paykr:activate' });
app.worker.dispatchEvent(new Event('controllerchange'));
assert.equal(app.reloads(), 1);

app = await browser({ ios: true, storageDenied: true });
app.start();
app.doc.dispatchEvent(new Event('paykr:explored'));
assert(app.panel.children[0].hidden && app.menu.hidden && !app.iosGuide.hidden);
app.iosGuide.click();
assert(app.panel.children[1].focused);
assert.equal(app.panel.children[1].children[0].dataset.i18n, 'install.iosHelp');
app.panel.children[1].children[1].click();
assert(app.panel.children[0].hidden && app.panel.children[1].hidden);
app = await browser();
app.start();
app.doc.dispatchEvent(new Event('paykr:explored'));
assert(app.panel.children[0].hidden && app.menu.hidden && app.iosGuide.hidden);
app.menu.click();
assert(app.panel.children[1].hidden);
let nativeCalls = 0;
app = await browser({ install: async () => { nativeCalls++; } });
app.start();
const redundantPrompt = app.prompt('accepted');
app.menu.click();
await tick();
assert.equal(nativeCalls, 1);
assert.equal(redundantPrompt(), 0);
assert(app.menu.hidden && app.panel.children[1].hidden);
app = await browser({ install: async () => { throw new DOMException('Canceled', 'AbortError'); } });
app.start();
app.menu.click();
await tick();
assert(!app.menu.hidden && app.panel.children[1].hidden);
app = await browser({ standalone: true });
app.start();
app.doc.dispatchEvent(new Event('paykr:explored'));
assert(app.menu.hidden && app.panel.children[0].hidden);

console.log(
  'PASS: manifest and real PNGs, scoped atomic shell and integrity, offline navigation, third-party exclusions, update approval and cross-tab reload, early/dismissed/accepted install events, iOS help, restricted storage, standalone and network status',
);

if (process.argv.includes('--browser')) {
  const { withBrowser } = await import('./browser-env.mjs');
  await withBrowser(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja' });
    // No third-party service is needed to install or read the offline guide.
    await context.route('**/*', (route) =>
      route.request().url().startsWith(base) ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    await page.goto(base + 'guide.html?lang=ja');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 20000,
    });
    const urls = await page.evaluate(async () => {
      const cache = await caches.open((await caches.keys()).find((name) => name.includes('paykr-shell:')));
      return (await cache.keys()).map((request) => request.url);
    });
    assert(urls.every((url) => url.startsWith(base) && !new URL(url).search));
    assert(urls.includes(base + 'guide.html') && urls.includes(base + 'offline.html'));
    await context.setOffline(true);
    let response = await page.goto(base + 'offline.html?lang=ko');
    assert(response.fromServiceWorker());
    await page.waitForFunction(() => document.documentElement.lang === 'ko');
    assert.match(await page.locator('blockquote').first().textContent(), /애플페이/);
    response = await page.goto(base + 'guide.ar.html');
    assert(response.fromServiceWorker());
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    response = await page.goto(base + 'terms.html');
    assert(response.fromServiceWorker());
    assert.equal(await page.locator('h2[id^="article-"]').count(), 17);
    response = await page.goto(base + 'guide.html?lang=zh-Hant');
    assert(response.fromServiceWorker());
    await page.waitForFunction(() => document.documentElement.lang === 'zh-Hant');
    assert(
      await page
        .locator('.pwa-card')
        .filter({ has: page.locator('[data-i18n="offline.body"]') })
        .isVisible(),
    );
    await context.setOffline(false);
    await page.waitForFunction(
      () =>
        navigator.onLine &&
        document.querySelector('.pwa-card [data-i18n="offline.body"]').parentElement.hidden,
    );
    await context.close();
    console.log(
      'PASS: Chromium installed the integrity-checked shell under /PayKR/; offline KO and zh-Hant direct navigation, question cards and reconnection',
    );
  });
}

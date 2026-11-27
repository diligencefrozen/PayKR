importScripts('./pwa-assets.js');

const scope = self.registration.scope;
const prefix = 'paykr-shell:' + new URL(scope).pathname + ':';
const revision = prefix + self.PAYKR_RELEASE;
const assets = new Map(self.PAYKR_SHELL.map(([path, hash]) => [new URL(path, scope).href, hash]));
const pages = new Set([...assets.keys()].filter((url) => url.endsWith('.html')));
const offlinePage = new URL('offline.html', scope).href;

self.addEventListener('install', (event) => {
  // addAll is atomic. Integrity failure leaves the installed release intact.
  const requests = [...assets].map(
    ([url, integrity]) =>
      new Request(url, {
        cache: 'reload',
        credentials: 'omit',
        integrity,
      }),
  );
  event.waitUntil(caches.open(revision).then((cache) => cache.addAll(requests)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(prefix) && key !== revision) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'paykr:activate') event.waitUntil(self.skipWaiting());
});

async function navigate(request, canonical) {
  let network;
  try {
    // Never cache navigation parameters. They can carry a private search term.
    network = await fetch(request);
    if (network.ok && !network.redirected) {
      const bytes = await network.clone().arrayBuffer();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      const integrity = 'sha256-' + btoa(String.fromCharCode(...digest));
      if (assets.get(canonical).split(' ').includes(integrity)) return network;
      // A new HTML shell needs its matching modules. Offer it when its worker is ready.
      self.registration.update().catch(() => {});
    }
  } catch {
    /* Use the installed shell while disconnected. */
  }
  try {
    const cache = await caches.open(revision);
    return (await cache.match(canonical)) || network || (await cache.match(offlinePage)) || Response.error();
  } catch {
    return network || Response.error();
  }
}
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(scope).pathname)) return;
  const canonical = url.origin + url.pathname;
  if (request.mode === 'navigate') {
    const page = canonical === scope ? new URL('index.html', scope).href : canonical;
    if (pages.has(page)) event.respondWith(navigate(request, page));
    return;
  }
  if (!assets.has(canonical) || pages.has(canonical)) return;
  if (url.search && !/^\?v=[a-z0-9._-]+$/i.test(url.search)) return;
  event.respondWith(
    caches
      .open(revision)
      .then((cache) => cache.match(canonical))
      .catch(() => null)
      .then((cached) => cached || fetch(request)),
  );
});

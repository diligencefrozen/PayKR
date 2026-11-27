// Capture the browser's one-use event even while the selected dictionary loads.
let deferredPrompt;
let confirmed = false;
const browser = globalThis.window;
browser?.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  browser.dispatchEvent(new Event('paykr:installability'));
});
browser?.addEventListener('appinstalled', () => {
  confirmed = true;
  deferredPrompt = null;
  browser.dispatchEvent(new Event('paykr:installed'));
});

const SNOOZE = 7 * 24 * 60 * 60 * 1000;
const scope = new URL('../../../', import.meta.url);
const snoozeKey = 'paykr.install.later.' + scope.pathname;
let active;

export function initPwa(t) {
  if (active) return active;
  const host =
    document.querySelector('[data-pwa-panel]') || document.body.appendChild(document.createElement('aside'));
  const menuButtons = [...document.querySelectorAll('[data-install]')];
  const iosGuide = document.querySelector('[data-install-help]');
  const nativeInstall = window.isSecureContext && typeof navigator.install === 'function';
  const display = window.matchMedia('(display-mode: standalone)');
  const isStandalone = () => confirmed || display.matches || navigator.standalone === true;
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const metrics = { impressions: 0, actions: 0, confirmed: 0 };
  let explored = false;
  let busy = false;
  let manualHelp = false;
  let snoozeUntil = 0;
  let waiting;
  let approved = false;
  try {
    snoozeUntil = Number(localStorage.getItem(snoozeKey)) || 0;
  } catch {
    /* Private browsing */
  }

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./install.css', import.meta.url).href;
  document.head.append(stylesheet);

  function label(tag, key) {
    const node = document.createElement(tag);
    node.dataset.i18n = key;
    node.textContent = t(key);
    return node;
  }
  function card(key) {
    const element = document.createElement('section');
    element.className = 'pwa-card';
    element.hidden = true;
    const message = label('p', key);
    message.setAttribute('role', 'status');
    element.append(message);
    host.append(element);
    return element;
  }
  function button(element, key, onClick, secondary = false) {
    const node = label('button', key);
    node.type = 'button';
    if (secondary) node.className = 'secondary';
    node.addEventListener('click', onClick);
    element.append(node);
    return node;
  }
  const promotion = card('install.title');
  const promoteButton = button(promotion, 'install.action', install);
  button(promotion, 'install.later', dismiss, true);
  const help = card('install.iosHelp');
  help.tabIndex = -1;
  button(help, 'common.close', () => {
    manualHelp = false;
    render();
    (menuButtons.find(node => !node.hidden && node.getClientRects().length) || document.querySelector('[data-more]:not([hidden])'))?.focus();
  }, true);
  const update = card('install.update');
  button(update, 'install.reload', () => {
    if (waiting?.state !== 'installed') return;
    approved = true;
    waiting.postMessage({ type: 'paykr:activate' });
  });
  const offline = card('offline.body');
  button(offline, 'offline.retry', () => location.reload());

  function render() {
    const installed = isStandalone();
    const available = !installed && (Boolean(deferredPrompt) || nativeInstall);
    const show = available && explored && Date.now() >= snoozeUntil && !manualHelp && !busy && !waiting;
    if (show && promotion.hidden) metrics.impressions++;
    promotion.hidden = !show;
    help.hidden = installed || !manualHelp;
    for (const node of menuButtons) {
      node.hidden = !available;
      node.disabled = busy;
    }
    if (iosGuide) iosGuide.hidden = installed || available || !ios;
    promoteButton.disabled = busy;
    offline.hidden = navigator.onLine !== false;
    update.hidden = !waiting;
  }
  function showHelp(key) {
    manualHelp = true;
    const message = help.children[0];
    message.dataset.i18n = key;
    message.textContent = t(key);
    render();
    help.focus();
  }
  function dismiss() {
    snoozeUntil = Date.now() + SNOOZE;
    try {
      localStorage.setItem(snoozeKey, String(snoozeUntil));
    } catch {
      /* Still dismissed for this visit */
    }
    manualHelp = false;
    render();
    menuButtons.find((node) => !node.hidden && node.getClientRects().length)?.focus();
  }
  async function install() {
    const prompt = deferredPrompt;
    if (busy || isStandalone() || (!nativeInstall && !prompt)) return;
    metrics.actions++;
    deferredPrompt = null;
    busy = true;
    manualHelp = false;
    render();
    try {
      if (nativeInstall) {
        await navigator.install();
        confirmed = true;
      } else {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'dismissed') dismiss();
      }
    } catch (error) {
      if (error.name === 'AbortError') dismiss();
      else showHelp('install.failed');
    } finally {
      busy = false;
      render();
    }
  }
  menuButtons.forEach((node) => node.addEventListener('click', install));
  iosGuide?.addEventListener('click', () => showHelp('install.iosHelp'));
  document.addEventListener('paykr:explored', () => {
    explored = true;
    render();
  });
  window.addEventListener('paykr:installability', render);
  window.addEventListener('paykr:installed', () => {
    metrics.confirmed++;
    render();
  });
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  window.addEventListener('storage', (event) => {
    if (event.key === snoozeKey) {
      snoozeUntil = Number(event.newValue) || 0;
      render();
    }
  });
  display.addEventListener?.('change', render);
  render();

  const workers = navigator.serviceWorker;
  if (workers && window.isSecureContext) {
    workers.addEventListener('controllerchange', () => {
      waiting = null;
      render();
      if (approved) {
        approved = false;
        location.reload();
      }
    });
    workers
      .register(new URL('sw.js', scope), { scope: scope.href, updateViaCache: 'none' })
      .then((registration) => {
        function inspect() {
          waiting = workers.controller ? registration.waiting : null;
          render();
        }
        function watch() {
          registration.installing?.addEventListener('statechange', inspect);
          inspect();
        }
        registration.addEventListener('updatefound', watch);
        watch();
      })
      .catch(() => {
        /* The website remains usable if storage is disabled. */
      });
  }
  active = { metrics };
  return active;
}

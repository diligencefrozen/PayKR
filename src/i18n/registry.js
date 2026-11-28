// Import only the English fallback and the visitor's chosen dictionary.
export const locales = Object.freeze({
  en: { name: 'English', short: 'EN', dir: 'ltr', load: () => import('./en.js') },
  ko: { name: '한국어', short: 'KO', dir: 'ltr', load: () => import('./ko.js') },
  ja: { name: '日本語', short: 'JP', dir: 'ltr', load: () => import('./ja.js') },
  'zh-Hans': { name: '简体中文', short: '简中', dir: 'ltr', load: () => import('./zh-Hans.js') },
  'zh-Hant': { name: '繁體中文', short: '繁中', dir: 'ltr', load: () => import('./zh-Hant.js') },
  th: { name: 'ไทย', short: 'TH', dir: 'ltr', load: () => import('./th.js') },
  vi: { name: 'Tiếng Việt', short: 'VI', dir: 'ltr', load: () => import('./vi.js') },
  id: { name: 'Bahasa Indonesia', short: 'ID', dir: 'ltr', load: () => import('./id.js') },
  ms: { name: 'Bahasa Melayu', short: 'MS', dir: 'ltr', load: () => import('./ms.js') },
  ar: { name: 'العربية', short: 'AR', dir: 'rtl', load: () => import('./ar.js') },
  hi: { name: 'हिन्दी', short: 'HI', dir: 'ltr', load: () => import('./hi.js') },
  mn: { name: 'Монгол', short: 'MN', dir: 'ltr', load: () => import('./mn.js') },
  ru: { name: 'Русский', short: 'RU', dir: 'ltr', load: () => import('./ru.js') },
});

export function canonicalLocale(tag) {
  if (typeof tag !== 'string' || !tag || tag.length > 128) return null;
  try {
    const { language, script, region } = new Intl.Locale(tag.trim());
    if (language === 'zh') {
      if (script) return ['Hans', 'Hant'].includes(script) ? 'zh-' + script : null;
      return ['TW', 'HK', 'MO'].includes(region) ? 'zh-Hant' : 'zh-Hans';
    }
    return Object.hasOwn(locales, language) ? language : null;
  } catch { return null; }
}

export function negotiateLocale(explicit, saved, languages = []) {
  return [explicit, saved, ...languages].map(canonicalLocale).find(Boolean) || 'en';
}

let current = 'en';
let messages = {};
let fallback = {};
let generation = 0;
const substitutions = new WeakMap();
const boundSelectors = new WeakSet();
export const getLocale = () => current;
export const formatNumber = (value, options) => new Intl.NumberFormat(current, options).format(value);
export const formatDate = (value, options = {}) =>
  new Intl.DateTimeFormat(current, { dateStyle: 'medium', timeZone: 'UTC', ...options }).format(new Date(value));

export function t(key, values = {}) {
  const template = Object.hasOwn(messages, key) ? messages[key] : Object.hasOwn(fallback, key) ? fallback[key] : key;
  return template.replace(/\{(\w+)\}/g, (token, field) => {
    const value = values[field];
    return typeof value === 'number' ? formatNumber(value) : value ?? token;
  });
}

export function localizedPagePath(path, lang) {
  if (lang === 'en') return path;
  if (path === './') return './index.' + lang + '.html';
  return path.replace(/^(\.\/)?(index|online|guide)\.html(?=[?#]|$)/, (_, prefix = '', page) =>
    prefix + page + '.' + lang + '.html');
}

export function pageLink(path) {
  const url = new URL(localizedPagePath(path, current), location.href);
  if (url.origin !== location.origin) throw new TypeError('Expected a same-origin page link');
  url.searchParams.set('lang', current);
  if (new URLSearchParams(location.search).get('adpreview') === '1') url.searchParams.set('adpreview', '1');
  return url.href;
}

export function translatedText(el, key, values = {}) {
  substitutions.set(el, values);
  el.dataset.i18n = key;
  el.textContent = t(key, values);
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n, substitutions.get(el));
  });
  for (const attr of ['aria-label', 'title', 'placeholder', 'content']) {
    const binding = 'data-i18n-' + attr;
    root.querySelectorAll('[' + binding + ']').forEach(el => el.setAttribute(attr, t(el.getAttribute(binding))));
  }
  root.querySelectorAll('[data-locale], [data-language]').forEach(select => {
    if (!boundSelectors.has(select)) {
      select.replaceChildren(...Object.entries(locales).map(([id, entry]) => {
        const option = document.createElement('option');
        option.value = id;
        option.lang = id;
        option.textContent = select.hasAttribute?.('data-compact') ? entry.short : entry.name;
        option.title = entry.name;
        return option;
      }));
      select.addEventListener('change', () => {
        setLocale(select.value).catch(() => { select.value = current; });
      });
      boundSelectors.add(select);
    }
    select.value = current;
  });
  root.querySelectorAll('a[data-page]').forEach(link => { link.href = pageLink(link.dataset.page); });
  root.querySelectorAll('time[data-local-date]').forEach(el => { el.textContent = formatDate(el.dateTime); });
}

export async function setLocale(tag, { persist = true } = {}) {
  const next = canonicalLocale(tag);
  if (!next) return current;
  const request = ++generation;
  const [base, translated] = await Promise.all([locales.en.load(), locales[next].load()]);
  if (request !== generation) return current;
  current = next;
  fallback = base.default;
  messages = translated.default;
  if (typeof document === 'undefined') return current;
  if (persist) {
    try { localStorage.setItem('paykr-language', current); } catch { /* Storage may be disabled. */ }
    const url = new URL(location.href);
    url.searchParams.set('lang', current);
    history.replaceState(history.state, '', url);
  }
  document.documentElement.lang = current;
  document.documentElement.dir = locales[current].dir;
  applyI18n();
  const canonical = document.querySelector('link[rel="canonical"]');
  const alternate = document.querySelector('link[hreflang="' + current + '"]');
  if (canonical && alternate) canonical.href = alternate.href;
  const detail = { locale: current, language: current };
  window.dispatchEvent(new CustomEvent('localechange', { detail }));
  document.dispatchEvent(new CustomEvent('paykr:languagechange', { detail }));
  return current;
}

export async function initLocale() {
  let saved;
  try { saved = localStorage.getItem('paykr-language'); } catch { /* The URL and browser preferences still work. */ }
  const explicit = new URLSearchParams(location.search).get('lang');
  const requested = negotiateLocale(explicit || document.documentElement.dataset?.entryLocale, saved, navigator.languages?.length ? navigator.languages : [navigator.language]);
  window.PayKRI18n = { t, get language() { return current; }, getLocale, setLocale, pageLink, translatedText, applyI18n };
  try { return await setLocale(requested, { persist: false }); }
  catch (error) {
    if (requested === 'en') throw error;
    return setLocale('en', { persist: false });
  }
}

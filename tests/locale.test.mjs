import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyI18n,
  canonicalLocale,
  formatDate,
  formatNumber,
  getLocale,
  initLocale,
  locales,
  negotiateLocale,
  pageLink,
  setLocale,
  t,
} from '../src/i18n/registry.js';

const base = (await locales.en.load()).default;
const guide = await readFile(new URL('../guide.html', import.meta.url), 'utf8');
for (const binding of guide.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)) {
  assert.ok(Object.hasOwn(base, binding[1]), 'Missing guide binding ' + binding[1]);
}
const placeholders = (template) => [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
for (const { load } of Object.values(locales)) {
  const dict = (await load()).default;
  assert.deepEqual(Object.keys(dict).sort(), Object.keys(base).sort());
  for (const [key, message] of Object.entries(dict)) {
    assert.ok(message.trim(), key);
    assert.deepEqual(placeholders(message), placeholders(base[key]), key);
  }
}
assert.equal(canonicalLocale('JA-jp'), 'ja');
assert.equal(canonicalLocale('en-US-u-hc-h23'), 'en');
assert.equal(canonicalLocale('zh-TW'), 'zh-Hant');
assert.equal(canonicalLocale('zh-HK'), 'zh-Hant');
assert.equal(canonicalLocale('zh-MO'), 'zh-Hant');
assert.equal(canonicalLocale('zh-SG'), 'zh-Hans');
assert.equal(canonicalLocale('zh-Hans-TW'), 'zh-Hans');
assert.equal(canonicalLocale('zh-Hant-CN'), 'zh-Hant');
assert.equal(canonicalLocale('%2Fother'), null);
assert.equal(canonicalLocale('__proto__'), null);
assert.equal(negotiateLocale('fr', 'de', ['ru', 'ko-KR', 'en']), 'ru');
assert.equal(negotiateLocale('ja', 'ko', ['en']), 'ja');
assert.equal(negotiateLocale(null, 'ja', ['en']), 'ja');
assert.equal(negotiateLocale(null, null, ['de']), 'en');

const label = { dataset: { i18n: 'guide.title' }, textContent: '' };
const select = {
  handlers: [],
  options: [],
  replaceChildren(...options) {
    this.options = options;
  },
  addEventListener(type, callback) {
    this.handlers.push(callback);
  },
};
const doc = Object.assign(new EventTarget(), {
  documentElement: {},
  querySelector: () => null,
  createElement: () => ({}),
  querySelectorAll: (selector) => {
    if (selector === '[data-i18n]') return [label];
    if (selector === '[data-locale], [data-language]') return [select];
    return [];
  },
});
const url = new URL('https://example.org/PayKR/guide.html?lang=ja&adpreview=1#phrases');
Object.assign(globalThis, { document: doc, window: new EventTarget(), location: url });
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem() {
      throw new Error('Storage disabled');
    },
    setItem() {
      throw new Error('Storage disabled');
    },
  },
  configurable: true,
});
globalThis.history = {
  state: { selection: 'preserve' },
  replaceState(state, _, next) {
    assert.deepEqual(state, this.state);
    url.href = next.href;
  },
};
await initLocale();
assert.equal(getLocale(), 'ja');
assert.equal(doc.documentElement.lang, 'ja');
assert.equal(label.textContent, '韓国でのApple Payの使い方');
assert.equal(select.value, 'ja');
assert.deepEqual(
  select.options.map((o) => o.value),
  Object.keys(locales),
);
const changed = new Promise((resolve) => window.addEventListener('localechange', resolve, { once: true }));
await setLocale('zh-HK');
assert.equal((await changed).detail.locale, 'zh-Hant');
assert.equal(url.hash, '#phrases');
assert.equal(url.searchParams.get('lang'), 'zh-Hant');
assert.equal(pageLink('./online.html'), 'https://example.org/PayKR/online.zh-Hant.html?lang=zh-Hant&adpreview=1');
assert.throws(() => pageLink('https://untrusted.example'));
await Promise.all([setLocale('ko'), setLocale('en')]);
assert.equal(getLocale(), 'en');
assert.equal(t('search.count', { count: 1234 }), 'Places found · 1,234');
assert.equal(formatDate('2026-11-26'), 'Nov 26, 2026');
assert.equal(formatNumber(1200), '1,200');
applyI18n();
assert.equal(select.handlers.length, 1);
console.log(
  'PASS: all registered dictionaries, placeholders, guide bindings, locale negotiation, restricted storage, latest selection, page state and formatting',
);

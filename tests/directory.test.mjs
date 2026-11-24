// Exercise the directory's actual input, filter, reset, and language handlers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const html = read('online.html');
class Control {
  dataset = {};
  events = {};
  hidden = false;
  value = '';
  setAttribute(key, value) { this[key] = value; }
  addEventListener(key, handler) { this.events[key] = handler; }
  focus() { this.focused = true; }
}
const ids = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Control()]));
const cards = [...html.matchAll(/<article class="brand" ([^>]+)>/g)].map(([, attrs]) => {
  const card = new Control();
  card.dataset = Object.fromEntries([...attrs.matchAll(/data-(\w+)="([^"]+)"/g)].map(([, key, value]) => [key, value]));
  const label = new Control();
  card.querySelector = () => label;
  card.after = element => { element.previousCard = card; };
  return card;
});
const buttons = [...html.matchAll(/<button [^>]*data-category="([^"]+)"/g)].map(([, category]) => {
  const button = new Control();
  button.dataset.category = category;
  return button;
});
const store = {};
function openPage(search, browserLanguage) {
  const languageSelect = new Control();
  const selectors = { '.brand': cards, '.brand[data-english]': cards, '.filters button': buttons, '[data-language]': [languageSelect] };
  const context = vm.createContext({
    URL, URLSearchParams, navigator: { language: browserLanguage }, location: { search, href: 'https://example.test/' + search },
    history: { replaceState() {} }, localStorage: { getItem: key => store[key], setItem: (key, value) => { store[key] = value; } },
    document: {
      documentElement: {}, getElementById: key => ids[key], querySelector() { return null; },
      querySelectorAll: key => selectors[key] || []
    }
  });
  vm.runInContext(read('i18n.js'), context);
  vm.runInContext(read('online.js'), context);
  return { context, languageSelect };
}
const { context, languageSelect } = openPage('', 'en-US');
assert.equal(context.document.documentElement.lang, 'en');
assert.equal(cards.length, 36);
assert.equal(buttons.length, 6);
function search(query) {
  ids.searchInput.value = query;
  ids.searchInput.events.input();
  return cards.filter(card => !card.hidden);
}
assert.equal(search('cOsT co')[0].dataset.name, '코스트코');
assert.equal(search('롯데온')[0].dataset.name, '롯데ON');
assert.equal(search('배민')[0].dataset.name, '배달의민족');
assert.equal(ids['directory-middle-ad'].hidden, true);
buttons.find(button => button.dataset.category === 'travel').events.click();
assert.equal(ids.empty.hidden, false);
ids.reset.events.click();
assert.equal(ids.totalCount.textContent, 'Brands · 36');
assert.equal(ids['directory-middle-ad'].previousCard, cards[7]);
languageSelect.value = 'ko';
languageSelect.events.change();
assert.equal(openPage('', 'en-US').context.document.documentElement.lang, 'ko');
assert.equal(openPage('?lang=en', 'ko-KR').context.document.documentElement.lang, 'en');
console.log('PASS: directory inventory, bilingual alias search, language persistence, combined filters, reset and ad placement');

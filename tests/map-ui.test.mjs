// Run with `node tests/map-ui.test.mjs`. No network or third-party test packages.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');
const elements = [];
class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.dataset = {}; this.attrs = {};
    this.style = { setProperty() {} }; this.events = {}; this.hidden = false; this.value = '';
    this.classList = { toggle() {}, add() {}, remove() {} };
    elements.push(this);
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); }
  replaceChildren(...children) { this.children = children; }
  set innerHTML(value) { this.html = value; this.children = []; }
  get innerHTML() { return this.html; }
  setAttribute(name, value) { this.attrs[name] = value; }
  getAttribute(name) { return this.attrs[name]; }
  addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
  fire(name, props = {}) { (this.events[name] || []).forEach(fn => fn({ preventDefault() {}, ...props })); }
  getBoundingClientRect() { return { top: 650 }; }
  focus() {} blur() {} setPointerCapture() {}
}
const ids = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], new Element()]));
const filters = [new Element('button'), new Element('button')];
const document = {
  getElementById: id => ids[id], createElement: tag => new Element(tag), body: new Element(), documentElement: new Element(),
  querySelectorAll(selector) {
    if (selector === '.filter-toggle') return filters;
    if (selector === '[data-category][aria-pressed]') return elements.filter(el => el.dataset.category && el.attrs['aria-pressed']);
    if (selector === '.search-result-item') return elements.filter(el => el.className === 'search-result-item');
    return [];
  },
  querySelector() { return null; }, addEventListener() {}
};
const requests = [], markers = [], crates = [], ready = [];
let mapCount = 0;
class Map {
  constructor(container, options) { this.center = options.center; this.level = options.level; mapCount++; }
  setCenter(center) { this.center = center; } setLevel(level) { this.level = level; } getBounds() { return {}; } relayout() {}
}
class Marker {
  constructor(options) { this.map = options.map; this.position = options.position; markers.push(this); }
  setMap(map) { this.map = map; } getMap() { return this.map; }
}
class Crate {
  constructor(options) { this.options = options; crates.push(this); }
  setOptions(options) { Object.assign(this.options, options); } toggle(open) { this.open = open; }
}
const context = vm.createContext({ document, console, URLSearchParams, Number, String, Event: class {},
  navigator: { language: 'ko-KR' }, location: { search: '' }, innerHeight: 800, innerWidth: 390,
  setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: fn => fn(),
  getComputedStyle: () => ({ getPropertyValue: () => '0px' }), applyI18n() {}, Crate,
  addEventListener: (name, fn) => { if (name === 'DOMContentLoaded') ready.push(fn); }, dispatchEvent() {},
  kakao: { maps: { Map, Marker, CustomOverlay: Marker,
    LatLng: class { constructor(lat, lng) { this.lat = lat; this.lng = lng; } },
    MarkerImage: class {}, Size: class {}, Point: class {},
    event: { addListener(target, name, fn) { (target.events ||= {})[name] = fn; } },
    load: fn => fn(), services: { Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT' },
      Places: class { keywordSearch(keyword, callback) { requests.push({ keyword, callback }); } }
    }
  } }
});
context.window = context;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (!match[1].includes('src=') && !match[1].includes('application/ld+json')) vm.runInContext(match[2], context);
}
vm.runInContext(fs.readFileSync(new URL('main.js', root), 'utf8'), context);
ready.forEach(fn => fn());
context.initMap();
assert.equal(mapCount, 1, 'SDK initializes the map exactly once');
assert.equal(ids['mobile-categories'].children.length, 14, 'all existing categories and All remain available');
const category = name => ids['mobile-categories'].children.find(el => el.dataset.category === name);
category('생활/가전').fire('click');
const stale = requests[0];
category('외식').fire('click');
const place = { id: '1', place_name: '<b>테스트 장소</b>', x: '127.93', y: '37.34', address_name: '테스트 주소', category_name: '음식점', phone: '033-123-4567' };
stale.callback([place], 'OK');
assert.equal(markers.length, 0, 'late results from previous category are discarded');
requests.at(-1).callback([place], 'OK');
markers[0].events.click();
assert.equal(ids['place-title'].textContent, place.place_name, 'place names render as plain text');
assert.equal(ids['sheet-toggle'].attrs['aria-expanded'], 'true');
context.PayKR.initChat(); context.PayKR.initChat();
assert.equal(crates.length, 1, 'Crate is a singleton');
assert.equal(crates[0].options.server, '1574706452671504474');
assert.equal(crates[0].options.channel, '1574706454353412239');
assert.ok(crates[0].options.location[0] < -100, 'chat button clears the sheet');
crates[0].toggle(true); crates[0].toggle(false);
assert.equal(ids['place-title'].textContent, place.place_name, 'chat preserves selected place');
ids['place-clear'].fire('click');
assert.equal(ids['place-title'].textContent, '이 지역의 장소 찾기');
assert.equal(ids['sheet-toggle'].attrs['aria-expanded'], 'false');
ids['sheet-toggle'].fire('pointerdown', { clientY: 500, pointerId: 1 });
ids['sheet-toggle'].fire('pointermove', { clientY: 450 });
assert.equal(ids['sheet-toggle'].attrs['aria-expanded'], 'true', 'upward drag expands the sheet');
ids['sheet-toggle'].fire('pointermove', { clientY: 550 });
assert.equal(ids['sheet-toggle'].attrs['aria-expanded'], 'false', 'downward drag collapses the sheet');
ids['sheet-toggle'].fire('pointerup');
ids['search-input-mobile'].value = '테스트';
ids['search-box-mobile'].fire('submit');
const search = requests.at(-1);
assert.equal(search.keyword, '테스트');
search.callback([place, { ...place, id: '2', place_name: '두 번째 장소' }], 'OK');
assert.equal(ids['mobile-results'].children.length, 3, 'mobile results are available in the sheet');
ids['mobile-results'].children[2].fire('click');
assert.equal(ids['place-title'].textContent, '두 번째 장소');
vm.runInContext("map.events.click()", context);
assert.equal(ids['place-title'].textContent, '이 지역의 장소 찾기', 'map background deselects the place');
assert.ok(!html.includes('href="forum/"'));
assert.ok(!html.includes('id="search-submit'));
console.log('PASS: initialization, category races, place selection, safe text, sheet gestures, search results, chat singleton/state/position, removed navigation');

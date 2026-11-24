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
    if (selector === '[data-i18n]') return elements.filter(el => el.dataset.i18n);
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
  setCenter(center) { this.center = center; } setLevel(level) { this.level = level; } getBounds() { return { center: this.center }; } relayout() {}
}
class Marker {
  constructor(options) { this.map = options.map; this.position = options.position; markers.push(this); }
  setMap(map) { this.map = map; } getMap() { return this.map; }
}
class Crate {
  constructor(options) { this.options = options; crates.push(this); }
  setOptions(options) { Object.assign(this.options, options); } toggle(open) { this.open = open; }
}
const stored = {};
const gpsRequests = [];
const context = vm.createContext({ document, console, URL, URLSearchParams,
  localStorage: { getItem: key => stored[key], setItem: (key, value) => { stored[key] = value; } },
  history: { replaceState() {} }, Number, String, Event: class {},
  navigator: { language: 'ko-KR', geolocation: { getCurrentPosition: (success, error) => gpsRequests.push({ success, error }) } }, location: { href: 'https://example.test/', search: '' }, innerHeight: 800, innerWidth: 390,
  setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: fn => fn(),
  matchMedia: () => ({ matches: false }),
  getComputedStyle: () => ({ getPropertyValue: () => '0px' }), Crate,
  addEventListener: (name, fn) => { if (name === 'DOMContentLoaded') ready.push(fn); }, dispatchEvent() {},
  kakao: { maps: { Map, Marker, CustomOverlay: Marker,
    LatLng: class { constructor(lat, lng) { this.lat = lat; this.lng = lng; } },
    MarkerImage: class {}, Size: class {}, Point: class {},
    event: { addListener(target, name, fn) { (target.events ||= {})[name] = fn; } },
    load: fn => fn(), services: { Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT' },
      Places: class { keywordSearch(keyword, callback, options) { requests.push({ keyword, callback, options }); } }
    }
  } }
});
context.window = context;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (!match[1].includes('src=') && !match[1].includes('application/ld+json')) vm.runInContext(match[2], context);
}
vm.runInContext(fs.readFileSync(new URL('i18n.js', root), 'utf8'), context);
vm.runInContext(fs.readFileSync(new URL('main.js', root), 'utf8'), context);
ready.forEach(fn => fn());
context.initMap();
assert.equal(mapCount, 1, 'SDK initializes the map exactly once');
assert.equal(ids['mobile-categories'].children.length, 14, 'all existing categories and All remain available');
const category = name => ids['mobile-categories'].children.find(el => el.dataset.category === name);
const locate = () => ids['location-button'].fire('click');
const mapState = () => vm.runInContext('[map.center, map.level, currentPositionMarker]', context);
assert.equal(gpsRequests.length, 1, 'initialization requests location exactly once');
assert.equal(requests.length, 0, 'wait for a confirmed location before loading nearby stores');
locate();
assert.equal(gpsRequests.length, 1, 'a pending location request is reused');
gpsRequests.pop().success({ coords: { latitude: 35.16, longitude: 129.06 } });
assert.equal(requests.length, 4, 'nearby searches start with bounded concurrency');
const nearbyPlace = { id: 'nearby', place_name: 'GS25', x: '129.06', y: '35.16' };
for (const request of requests) {
  assert.equal(request.options.bounds.center, mapState()[0]);
  if (request.keyword === 'CU') continue; // Still in flight when the user chooses another category.
  request.callback([nearbyPlace], 'OK');
}
const keywords = requests.map(request => request.keyword);
assert.equal(new Set(keywords).size, keywords.length);
for (const name of ['GS25', '코스트코', '파리바게뜨', '롯데리아', '스타벅스', '하이오커피']) assert.ok(keywords.includes(name));
assert.ok(!keywords.includes('롯데호텔'));
assert.equal(vm.runInContext('categoryMarkers.length', context), 1, 'deduplicate places matched by different keywords');
const pendingNearby = requests.find(request => request.keyword === 'CU');
category('생활/가전').fire('click');
const stale = requests.at(-1);
category('외식').fire('click');
const place = { id: '1', place_name: '<b>테스트 장소</b>', x: '127.93', y: '37.34', address_name: '테스트 주소', category_name: '음식점', phone: '033-123-4567' };
const markerCount = markers.length;
pendingNearby.callback([nearbyPlace], 'OK');
stale.callback([place], 'OK');
assert.equal(markers.length, markerCount, 'late results from nearby and previous category searches are discarded');
requests.at(-1).callback([place], 'OK');
vm.runInContext('categoryMarkers[0].events.click()', context);
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
// The All control must issue exactly the same searches as the individual categories combined.
const categoryKeywords = [];
for (const button of ids['mobile-categories'].children) {
  if (button.dataset.category !== '전체' && button.getAttribute('aria-pressed') !== undefined) {
    const start = requests.length;
    button.fire('click');
    categoryKeywords.push(...requests.slice(start).map(request => request.keyword));
  }
}
const beforeAll = requests.length;
category('전체').fire('click');
assert.deepEqual(requests.slice(beforeAll).map(request => request.keyword).sort(), categoryKeywords.sort());
for (const id of ['desktop-categories', 'mobile-categories', 'filter-categories']) {
  const all = ids[id].children[0];
  assert.equal(all.children[0].textContent, '전체');
  assert.equal(all.getAttribute('aria-pressed'), 'true');
}

const previousCenter = mapState()[0];
locate();
vm.runInContext('map.events.dragstart()', context);
gpsRequests.pop().success({ coords: { latitude: 35.11, longitude: 129.01 } });
assert.equal(mapState()[0], previousCenter, 'a late location fix does not interrupt manual exploration');
const requestCount = requests.length;
locate();
gpsRequests.pop().success({ coords: { latitude: 37.5, longitude: 127 } });
assert.equal(requests.length, requestCount, 'manual recenter preserves an explicitly selected category');
const [center, level, marker] = mapState();
assert.equal(center.lat, 37.5);
assert.ok(marker);
for (const [code, key] of [[1, 'denied'], [2, 'unavailable'], [3, 'timeout']]) {
  locate();
  gpsRequests.pop().error({ code });
  const state = mapState();
  assert.equal(state[0], center);
  assert.equal(state[1], level);
  assert.equal(state[2], marker);
  assert.equal(ids['map-status'].dataset.i18n, 'location.' + key);
}
context.selectLanguage('en');
assert.equal(document.documentElement.lang, 'en');
assert.equal(stored['paykr-language'], 'en');
assert.equal(category('전체').children[0].textContent, 'All');
assert.match(ids['map-status'].textContent, /timed out/);
assert.equal(context.preferredLanguage(), 'en');
context.location.search = '?lang=ko';
assert.equal(context.preferredLanguage(), 'ko');
context.location.search = '?lang=de';
assert.equal(context.preferredLanguage(), 'en');
assert.equal(vm.runInContext("messages['test.fallback'] = ['한국어']; t('test.fallback')", context), '한국어');
assert.doesNotMatch(html, /ipapi\.co|getIpLocationFallback|\bfetch\(/);
const online = fs.readFileSync(new URL('online.html', root), 'utf8');
for (const source of [html, online]) {
  assert.equal((source.match(/adsbygoogle\.js\?client=ca-pub-3313505766731703/g) || []).length, 1);
  assert.doesNotMatch(source, /data-ad-slot|adsbygoogle\.push/);
}
assert.equal((online.match(/class="brand" data-category=/g) || []).length, 36);
assert.equal((online.match(/<button type="button" data-i18n="filter\./g) || []).length, 6);
console.log('PASS: All searches and selection, automatic location and nearby merchants, manual retries and errors, language precedence and fallback, directory inventory and registration-only ads');

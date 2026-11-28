import assert from 'node:assert/strict';
import { AdService } from '../src/infrastructure/ads/service.js';
class Node {
  constructor() {
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.classList = { add() {} };
  }
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = children;
  }
}
const win = new EventTarget();
globalThis.window = win;
const box = new Node();
box.dataset.slot = 'directory-top';
const doc = {
  head: new Node(),
  body: { dataset: { pageType: 'online' } },
  location: { search: '', hash: '' },
  querySelectorAll: () => [box],
  createElement: () => new Node(),
};
let consent,
  recovery = 0;
const config = {
  publisher: 'test-publisher',
  slots: { 'directory-top': '12345' },
  recoveryEnabled: true,
  subscribeConsent: (cb) => {
    consent = cb;
    cb(false);
  },
  mountOfficialRecovery: () => {
    recovery++;
  },
};
const net = { onLine: true },
  ads = new AdService(config, doc, net);
ads.start((k) => k);
ads.show(36);
assert(box.hidden);
assert.equal(recovery, 0);
assert.equal(doc.head.children.length, 0);
net.onLine = false;
consent(true);
assert(box.hidden);
assert.equal(recovery, 0);
net.onLine = true;
win.dispatchEvent(new Event('online'));
assert(!box.hidden);
assert.equal(recovery, 1);
assert.equal(doc.head.children.length, 1);
assert.equal(win.adsbygoogle.length, 1);
ads.show(8);
assert.equal(win.adsbygoogle.length, 1);
assert.equal(recovery, 1);
box.children[1].dataset.adStatus = 'unfilled';
ads.render();
assert.equal(recovery, 1);
assert.equal(win.adsbygoogle.length, 1);
doc.head.children[0].onerror();
assert(box.hidden);
assert.equal(recovery, 1);
consent(false);
ads.render();
assert(box.hidden);
doc.location.search = '?adpreview=1';
const preview = new AdService(config, doc, net);
preview.start((k) => k);
consent(true);
preview.show(36);
assert.equal(doc.head.children.length, 1);
assert.equal(recovery, 1);
assert.equal(box.textContent, 'advertisement.preview');
doc.location.hash = '#privacy';
preview.render();
assert(box.hidden);
console.log(
  'PASS: mock CMP unknown/denied/granted, offline, slot singleton, no-fill, SDK failure, official recovery hook, private page and preview exclusions',
);

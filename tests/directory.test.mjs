import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CatalogRepository } from '../src/repositories/catalog.js';
import { legacyClaim } from '../src/models/payment.js';
import { AdService } from '../src/infrastructure/ads/service.js';
import { issueLink } from '../src/services/feedback.js';
import { negotiateLocale } from '../src/i18n/registry.js';

const rows = JSON.parse(await readFile(new URL('../src/data/online.json', import.meta.url)));
const repo = new CatalogRepository(async () => rows);
assert.equal(rows.length, 36);
assert.equal(new Set(rows.map((r) => r.id)).size, 36);
assert.equal((await repo.query('online', 'all', 'cOsT co'))[0].names.ko, '코스트코');
assert.equal((await repo.query('online', 'all', '롯데온'))[0].names.ko, '롯데ON');
assert.equal((await repo.query('online', 'all', '배민'))[0].names.ko, '배달의민족');
assert.equal((await repo.query('online', 'travel', '배민')).length, 0);
assert.equal((await repo.query('online')).length, 36);
for (const r of rows) {
  assert((await readFile(new URL('../' + r.icon, import.meta.url))).length > 0);
  const claim = legacyClaim(r.id, 'online');
  assert.equal(claim.status, 'brand_listed');
  assert.equal(claim.evidence[0].reviewedAt, null);
}
assert.equal(negotiateLocale(null, 'ko', ['en-US']), 'ko');
assert.equal(negotiateLocale('en', 'ko', ['ko-KR']), 'en');
const ad = new AdService({}, { location: { search: '?adpreview=1' } }, {});
assert(ad.preview);
assert(ad.eligibleSlot('directory-middle', 12));
assert(!ad.eligibleSlot('directory-middle', 11));
assert(!ad.eligibleSlot('directory-bottom', 7));
assert(!ad.eligibleSlot('directory-top', 0));
const url = new URL(issueLink('report', 'A & B #1?'));
assert.equal(url.searchParams.get('template'), 'merchant.yml');
assert.equal(url.searchParams.get('title'), '[Merchant] A & B #1?');
for (const type of ['report', 'feature', 'bug', 'translation']) {
  const template = new URL(issueLink(type)).searchParams.get('template');
  assert.match(
    await readFile(new URL('../.github/ISSUE_TEMPLATE/' + template, import.meta.url), 'utf8'),
    /required: true/,
  );
}
console.log(
  'PASS: 36 assets and entities, original aliases, combined categories, reset, language precedence, ad thresholds and report forms',
);

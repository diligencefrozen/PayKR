import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { locales } from '../src/i18n/registry.js';
const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');
for (const [lang, { load }] of Object.entries(locales)) {
  const dict = (await load()).default;
  for (const page of ['index', 'online', 'guide']) {
    const html = await read(page + (lang === 'en' ? '' : '.' + lang) + '.html');
    assert(html.includes('<html lang="' + lang + '"'));
    assert(
      html.includes(
        '>' +
          dict[{ index: 'place.emptyTitle', online: 'ecommerce.heading', guide: 'guide.title' }[page]] +
          '</h1>',
      ),
    );
    for (const [, key] of html.matchAll(/data-i18n(?:-(?:placeholder|aria-label|content|title))?="([^"]+)"/g))
      assert(Object.hasOwn(dict, key), key);
    assert.equal((html.match(/<link rel="alternate" hreflang=/g) || []).length, Object.keys(locales).length + 1);
    for (const [, path] of html.matchAll(/(?:href|src)="\.\/([^"#?]+)"/g)) await read(path);
    assert(!/oncontextmenu|pagead2\.googlesyndication\.com|cdn\.jsdelivr\.net/.test(html));
  }
}
const views = (await readdir(new URL('../src/views/', import.meta.url))).filter((f) => f.endsWith('.js'));
for (const file of views)
  assert(
    !/(?:window\.kakao|indexedDB|from ['"][^'"]*infrastructure)/.test(await read('src/views/' + file)),
    file,
  );
console.log(
  'PASS: Localized crawlable entries, reciprocal alternates, translation bindings, local paths and view boundaries',
);

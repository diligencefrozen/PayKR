import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { locales } from '../src/i18n/registry.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const base='https://diligencefrozen.github.io/PayKR/';
const sitemap=await read('sitemap.xml');
const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
assert.equal(urls.length,42); assert.equal(new Set(urls).size,42);
const stores=JSON.parse(await read('src/data/stores.json'));
for(const url of urls){
 const path=url.slice(base.length)||'index.html';const html=await read(path);
 assert.equal([...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].length,1,path);
 assert(html.includes(`<link rel="canonical" href="${url}">`),path);
 if(path==='terms.html')continue;
 const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(graph['@graph'][1].url,url);
 assert(html.includes(`<meta property="og:url" content="${url}">`));
 for(const [,lang,alt] of html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)){
  assert(urls.includes(alt),lang); const other=await read(alt.slice(base.length)||'index.html');
  assert([...other.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].some(m=>m[2]===url),url);
 }
 if(path.startsWith('brands')){
  for(const store of stores)assert(html.includes('?q='+encodeURIComponent(store.names.ko)),store.id);
  assert(!html.includes('LocalBusiness')&&!html.includes('aggregateRating'));
 }else{
  assert(html.includes('data-entry-locale='));assert(html.includes('brands.'));
 }
}
console.log('PASS: 42 canonical URLs, reciprocal language links, JSON-LD, social metadata, 160 owned brands and no unsupported branch schema');

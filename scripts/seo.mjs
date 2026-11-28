// Search metadata and static, evidence-aware directory; no third-party place data.
import { readFile } from 'node:fs/promises';
import { locales } from '../src/i18n/registry.js';
const root = 'https://diligencefrozen.github.io/';
const base = root + 'PayKR/';
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const json = data => JSON.stringify(data).replaceAll('<','\\u003c');
const image = base + 'icons/paykr-512.png';
const attrs = (title, desc, url, lang) => `<meta name="robots" content="index,follow,max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="PayKR">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:alt" content="PayKR">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${image}">`;
const schema = (url, lang, title, desc, type='WebPage') => ({'@context':'https://schema.org','@graph':[
  {'@type':'WebSite','@id':root+'#website',url:root,name:'PayKR'},
  {'@type':type,'@id':url+'#page',url,name:title,description:desc,inLanguage:lang,isPartOf:{'@id':root+'#website'}}
]});
export function buildSeoHead({name, lang, url, dict}) {
  const [title,desc] = name==='index' ? [dict['map.title'],dict['map.description']] : name==='online' ? [dict['ecommerce.title'],dict['ecommerce.description']] : [dict['guide.meta'],dict['guide.description']];
  return '  '+attrs(title,desc,url,lang)+'\n  <script type="application/ld+json">'+json(schema(url,lang,title,desc,name==='online'?'CollectionPage':'WebPage'))+'</script>';
}
const labels = {ko:'애플페이 오프라인 브랜드 목록',en:'Apple Pay offline brand directory'};
export function resourceLinks(lang, name) {
  const ko=lang==='ko';
  const home=ko?root:root+'en/';
  const links = `<a href="${base}brands${ko?'.ko':''}.html" lang="${ko?'ko':'en'}">${labels[ko?'ko':'en']}</a> · <a href="${home}" lang="${ko?'ko':'en'}">PayKR ${ko?'소개':'home'}</a> · <a href="${home}privacy.html" lang="${ko?'ko':'en'}">${ko?'개인정보처리방침':'Privacy policy'}</a>`;
  return `<nav class="seo-resources" aria-label="PayKR"${ko||lang==='en'?'':' lang="en"'}>${links}</nav>`;
}
const categories = [
 ['편의점&카페','Convenience stores & cafés','convenience-cafes','편의점·카페'],['외식','Restaurants','restaurants','외식·식당'],['마트/슈퍼','Supermarkets','supermarkets','마트·슈퍼'],['제과/디저트','Bakeries & desserts','bakeries','제과·디저트'],['백화점/쇼핑','Department stores & shopping','shopping','백화점·쇼핑'],['패션/뷰티','Fashion & beauty','fashion','패션·뷰티'],['생활/가전','Home & electronics','electronics','생활·가전'],['호텔/리조트','Hotels & resorts','hotels','호텔·리조트'],['주유/충전','Fuel & charging','fuel','주유·충전'],['영화/도서','Cinema & books','cinema','영화·도서'],['레저/여행','Leisure & travel','leisure','레저·여행']
];
export async function directoryPages() {
 const stores=JSON.parse(await readFile(new URL('../src/data/stores.json',import.meta.url),'utf8'));
 const result=[];
 const alt=[['ko',base+'brands.ko.html'],['en',base+'brands.html'],['x-default',base+'brands.html']];
 for(const lang of ['ko','en']) {
  const ko=lang==='ko', file=ko?'brands.ko.html':'brands.html', url=base+file;
  const title=ko?'애플페이 오프라인 사용처 브랜드 목록 | 편의점·카페·쇼핑 - PayKR':'Apple Pay in Korea: Offline Merchant Brand Directory | PayKR';
  const desc=ko?'한국 애플페이 사용처 탐색용 브랜드를 편의점, 카페, 식당, 마트, 쇼핑 등 업종별로 정리했습니다. 브랜드를 선택하여 지도에서 매장을 찾고 실제 결제 가능 여부를 확인하세요.':'Explore Korean Apple Pay merchant candidates by category, from convenience stores and cafés to restaurants, shopping and hotels. Open a brand search and confirm acceptance at the branch.';
  const map=ko?'index.ko.html':'./', online=ko?'online.ko.html':'online.html', guide=ko?'guide.ko.html':'guide.html', home=ko?root:root+'en/';
  const groups=categories.map(([key,en,id,kr])=>({label:ko?kr:en,id,items:stores.filter(r=>r.categories.includes(key))}));
  const graph=schema(url,lang,title,desc,'CollectionPage');
  const links=groups.map(g=>`<li><a href="#${g.id}">${esc(g.label)} (${g.items.length})</a></li>`).join('');
  const sections=groups.map(g=>`<section id="${g.id}"><h2>${esc(g.label)}</h2><ul class="brands">${g.items.map(r=>{const name=r.names[lang]||r.names.en||r.names.ko;return `<li><a href="${map}?q=${encodeURIComponent(r.names.ko||name)}">${esc(name)}</a>${!ko&&r.names.ko!==name?` <small lang="ko">${esc(r.names.ko)}</small>`:''}</li>`}).join('')}</ul></section>`).join('\n');
  const html=`<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
${alt.map(([l,u])=>`<link rel="alternate" hreflang="${l}" href="${u}">`).join('\n')}
<link rel="icon" href="./favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="./seo.css">
<meta name="google-adsense-account" content="ca-pub-3313505766731703">
${attrs(title,desc,url,lang)}<script type="application/ld+json">${json(graph)}</script></head><body><header><a href="${home}">PayKR</a><nav><a href="${map}">${ko?'지도':'Map'}</a><a href="${online}">${ko?'온라인 사용처':'Online stores'}</a><a href="${guide}">${ko?'이용 가이드':'Guide'}</a><a href="${ko?'brands.html':'brands.ko.html'}" hreflang="${ko?'en':'ko'}" lang="${ko?'en':'ko'}">${ko?'English':'한국어'}</a></nav></header><main><h1>${ko?'애플페이 오프라인 사용처 브랜드 목록':'Apple Pay offline merchant brands in South Korea'}</h1><p>${esc(desc)}</p><p class="note"><strong>${ko?'중요: 결제 가능 매장 인증 목록이 아닙니다.':'Important: this is not a verified list of accepting branches.'}</strong> ${ko?'PayKR 자체 검색 카탈로그에 등록된 브랜드 '+stores.length+'개를 표시합니다. 이 목록만으로는 개별 지점의 결제 성공이 확인되지 않습니다. 브랜드·지점·단말기·카드별 결제 조건은 다를 수 있습니다.':'These '+stores.length+' brands come from PayKR’s own search catalog. The directory itself does not establish branch-level payment acceptance. Acceptance can vary by branch, terminal and card.'}</p><h2>${ko?'업종별 탐색':'Browse by category'}</h2><nav aria-label="${ko?'업종':'Categories'}"><ul class="categories">${links}</ul></nav>${sections}<section><h2>${ko?'매장에서 결제 가능 여부 확인하기':'How to check payment acceptance'}</h2><p>${ko?'브랜드명을 선택하면 지도 검색이 열립니다. 방문할 지점을 확인한 뒤 직원에게 애플페이 결제 가능 여부와 카드 조건을 문의하세요. 온라인 구매라면 실제 결제 화면에서 Apple Pay 옵션을 확인하세요.':'Select a brand to open the map search. Identify the branch, then ask the cashier whether your card can be used with Apple Pay. For online purchases, check for Apple Pay at checkout.'}</p><p><a href="${guide}">${ko?'한국 애플페이 이용 가이드':'Apple Pay travel guide'}</a> · <a href="https://github.com/diligencefrozen/PayKR/issues">${ko?'정보 수정 및 제보':'Suggest a correction'}</a></p></section></main><footer><a href="${home}about.html">${ko?'서비스 소개':'About'}</a> · <a href="${home}privacy.html">${ko?'개인정보처리방침':'Privacy'}</a> · <a href="${home}terms.html">${ko?'이용약관':'Terms'}</a> · <a href="${home}contact.html">${ko?'문의':'Contact'}</a><p>${ko?'PayKR은 Apple과 제휴하지 않은 독립 정보 서비스입니다.':'PayKR is an independent information service and is not affiliated with Apple.'}</p></footer></body></html>\n`;
  result.push({file,html,sitemap:`  <url><loc>${url}</loc>\n${alt.map(([l,u])=>`    <xhtml:link rel="alternate" hreflang="${l}" href="${u}"/>`).join('\n')}\n  </url>`});
 }
 return result;
}

import { normalize, metersBetween } from './payment.js';
// Conservative name + business category rules. Public data labels and Kakao categories
// are not identical; unrecognized categories are left for operator review, never inferred as verified.
const rules = {
  conveniencestore: /편의점/, cafe: /카페|커피|음료|찻집|차전문|주스|다방/,
  departmentstore: /백화점|면세점/, mall: /쇼핑|아울렛|백화점|면세점|복합|화장품|의류|패션/,
  mart: /마트|슈퍼|대형종합|종합소매|식료품|농산물|할인점/,
  bakery: /제과|제빵|빵|베이커리|아이스크림|빙수|떡|디저트|도넛|과자|커피|카페/,
  restaurants: /음식|식당|한식|중식|일식|양식|분식|햄버거|샌드위치|패스트푸드|치킨|찜닭|토스트|도시락|외국식|구내식당/,
  homeappliances: /가전|전자|컴퓨터|휴대폰|통신기기|가구|생활용품|잡화|문구|사무|완구|신발|인쇄|복사|침대|주방|가정용품/,
  hotelandresort: /호텔|숙박|리조트|휴양|콘도/, fasion: /화장품|의류|패션|잡화|신발|뷰티/,
  gasstation: /주유소|충전소|연료/, movieandbooks: /영화|서점|도서|문구|음반/,
  leisure: /테마파크|유원지|놀이|수족관|관광|여행|철도|기차|공항|라운지|스포츠|골프|전망|워터파크|휴양/,
};
const extra = {
 'store-11': ['메가MGC커피','메가엠지씨커피','메가엠지씨'],
 'store-66': ['배스킨라빈스','배스킨라빈스31','베스킨라빈스31'],
};
export function categoryMatches(brand, category) {
  return Boolean(rules[brand?.icon?.split('/').pop().replace('.png','')]?.test(String(category || '')));
}
export function matcher(brands) {
  const entries = brands.flatMap(brand => [...new Set([...Object.values(brand.names), ...brand.aliases, ...(extra[brand.id] || [])])]
    .map(alias=>({brand, alias: normalize(alias)})).filter(x=>x.alias.length>=2))
    .sort((a,b)=>b.alias.length-a.alias.length);
  return (name, category) => {
    const key=normalize(name);
    const hits=entries.filter(({alias,brand}) => {
      if (!key.startsWith(alias) || !categoryMatches(brand, category)) return false;
      if (key===alias) return true;
        const suffix=key.slice(alias.length);
      // Avoid e.g. CUCKOO, E1 unrelated businesses, and arbitrary long substring matches.
      return /^[가-힣0-9]+(?:점|지점|센터|매장|휴게소|역|공항|호텔|본점|영업소)$/.test(suffix) ||
        (/^[가-힣]/.test(alias) && /^[가-힣0-9]{1,25}$/.test(suffix) && /점$/.test(suffix));
    });
    if (!hits.length) return null;
    const top=hits.filter(x=>x.alias.length===hits[0].alias.length);
    return new Set(top.map(x=>x.brand.id)).size===1 ? top[0].brand : null;
  };
}
export function publicMerchant(row, match) {
  const id=String(row.bizesId||'');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return null;
  const name=String(row.bizesNm||'').trim(), branch=String(row.brchNm||'').trim();
  const category=[row.indsMclsNm,row.indsSclsNm,row.ksicNm].filter(Boolean).join(' > ');
  const brand=match(name,category) || (branch && match(name+' '+branch,category));
  const lat=Number(row.lat), lng=Number(row.lon);
  if (!brand || !name || !Number.isFinite(lat) || !Number.isFinite(lng) || lat<32.9 || lat>39 || lng<124 || lng>132.1) return null;
  const display=branch && !normalize(name).endsWith(normalize(branch)) ? name+' '+branch : name;
  const address=String(row.rdnmAdr||row.lnoAdr||'').trim();
  return {id,brand_id:brand.id,name:display,address,category: String(row.indsSclsNm||row.indsMclsNm||''),lat,lng,
    region:String(row.ctprvnCd||''), search_key:normalize(display+' '+address), active:true};
}
export function compareLive(place, rows, brands) {
  const match=matcher(brands);
  const same=rows.filter(row=>{
    const lat=Number(row.y),lng=Number(row.x);
    if (!Number.isFinite(lat)||!Number.isFinite(lng)) return false;
    const brand=match(row.place_name,row.category_name);
    const dist=metersBetween(place,{lat,lng});
    const nameEqual=normalize(row.place_name)===normalize(place.name);
    const addresses=[row.road_address_name,row.address_name].filter(Boolean).map(normalize);
    const addressEqual=Boolean(place.address && addresses.includes(normalize(place.address)));
    return brand?.id===place.claim.brandId && dist<=150 && (nameEqual || addressEqual);
  });
  return same.length===1 ? 'matched' : 'uncertain';
}

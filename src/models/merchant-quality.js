import { normalize, metersBetween } from './payment.js';
import { publicMerchant } from './merchant-match.js';
export const QUALITY_VERSION = 'v2';
// Explicit variants; generic corporate/operator names are not proof of a retail branch.
const aliases = {
 'store-1':['지에스25','지에스이십오','GS 25'], 'store-2':['씨유','시유'],
 'store-3':['세븐일레븐','쎄븐일레븐','7일레븐','7ELEVEN'], 'store-4':['이마트이십사','이마트 24'],
 'store-7':['씨스페이스','CSPACE24'], 'store-8':['스타벅스커피','스타벅스커피코리아'],
 'store-9':['투썸플레이스','A TWOSOME PLACE'], 'store-11':['메가MGC커피','메가엠지씨커피','메가엠지씨'],
 'store-12':['이디야'], 'store-14':['할리스커피'], 'store-16':['커피빈코리아','COFFEE BEAN'],
 'store-18':['폴 바셋'], 'store-34':['봄봄커피'], 'store-42':['갤러리아백화점'],
 'store-43':['AK PLAZA','에이케이플라자'], 'store-55':['홈플러스'], 'store-57':['GS더프레시','지에스더프레시'],
 'store-58':['하나로마트','농협하나로클럽'], 'store-63':['파리바게트','파리바게뜨'],
 'store-65':['뚜레쥬르','뚜레주르'], 'store-66':['배스킨라빈스','배스킨라빈스31','베스킨라빈스31'],
 'store-67':['던킨도너츠','던킨도넛'], 'store-68':['크리스피크림','크리스피크림도넛'],
 'store-75':['맥도날드','맥도날즈','MCDONALDS'], 'store-76':['케이에프씨'],
 'store-89':['빕스'], 'store-97':['아웃백'], 'store-103':['다이소'],
 'store-104':['하이마트'], 'store-105':['엘지전자베스트샵','LG베스트샵'],
 'store-110':['에이비씨마트','ABC MART'], 'store-142':['올리브영','CJ올리브영','씨제이올리브영'],
 'store-162':['컴포즈커피','COMPOSE COFFEE'],
};
const facility=/백화점|면세점|아울렛|쇼핑몰|쇼핑센터|복합쇼핑|대형종합소매|대형종합|기타대형종합/;
const rules={
 conveniencestore:/편의점/, cafe:/카페|커피|찻집|차전문|주스|다방|음료점/,
 departmentstore:facility, mall:facility,
 mart:/마트|슈퍼마켓|슈퍼|대형종합|종합소매|식료품|농산물|할인점|반찬|채소|과일/,
 bakery:/제과|제빵|빵|베이커리|아이스크림|빙수|떡|디저트|도넛|과자|커피|카페/,
 restaurants:/음식|식당|한식|중식|일식|양식|분식|햄버거|버거|샌드위치|패스트푸드|치킨|찜닭|토스트|도시락|외국식|구내식당|백반|한정식|김밥|만두|국수|칼국수|경양식|구이|찜|피자|베트남식|중국집|스테이크/,
 homeappliances:/가전|전자|컴퓨터|휴대폰|통신기기|가구|생활용품|잡화|문구|사무용품|완구|신발|복사업|인쇄|복사|침대|주방|가정용품|생활잡화/,
 hotelandresort:/호텔|숙박|리조트|휴양|콘도/, fasion:/화장품|의류|패션|잡화|신발|뷰티/,
 gasstation:/주유소|충전소|연료/, movieandbooks:/영화|서점|도서|문구|음반/,
 leisure:/테마파크|유원지|놀이|수족관|관광|여행|철도|기차|공항|라운지|스포츠|골프|전망|워터파크|휴양/,
};
const specific={
 'store-48':/의류|패션/, 'store-49':/화장품|뷰티/, 'store-74':/버거|햄버거|패스트푸드/,
 'store-75':/버거|햄버거|패스트푸드/, 'store-76':/치킨|닭|버거|햄버거|패스트푸드/,
 'store-77':/버거|햄버거|패스트푸드/, 'store-88':/토스트|샌드위치|샐러드|카페/,
 'store-101':/버거|햄버거|패스트푸드/, 'store-109':/문구|생활용품|잡화|완구|팬시/,
 'store-110':/신발/, 'store-113':/복사|인쇄|컴퓨터.*대여|사무기기.*대여/,
};
const generic=new Set(['store-71','store-82','store-84','store-85','store-91','store-98']);
const branchEnding=/(?:점|지점|센터|매장|휴게소|역|공항|호텔|본점|영업소|터미널|캠퍼스|병원|타워|빌딩|몰)$/;
const embedded=/빨래방|세탁소|만화방|만화카페|노래방|중개사|부동산|광고물|물류센터|사무소|본사/;
const compact=s=>String(s??'').normalize('NFKC').replace(/(?:\(주\)|주식회사|㈜)/g,'').trim();
function categoryLabel(input,codeLabels){
 if(typeof input==='string')return input.split('>').at(-1).trim();
 // Prefer official subcategory code mapping if provided; otherwise use the most specific source label.
 const code=String(input?.indsSclsCd??'');
 return (code&&codeLabels[code])||input?.indsSclsNm||input?.ksicNm||input?.indsMclsNm||'';
}
export function qualityMatcher(brands,{codeLabels={}}={}){
 const entries=brands.flatMap(brand=>[...new Set([...Object.values(brand.names),...brand.aliases,...(aliases[brand.id]||[])].map(normalize))].filter(x=>x.length>=2).map(alias=>({brand,alias}))).sort((a,b)=>b.alias.length-a.alias.length);
 const assess=(name,category,branch='')=>{
  const key=normalize(compact(name)), label=categoryLabel(category,codeLabels);
  const hits=entries.filter(e=>key.startsWith(e.alias));
  if(!hits.length)return {status:'unmatched',reason:'brand_not_found'};
  // Never downgrade a longer explicit brand to a shorter prefix (e.g. 홈플러스 익스프레스).
  const best=hits.filter(e=>e.alias.length===hits[0].alias.length);
  if(new Set(best.map(e=>e.brand.id)).size!==1)return {status:'review',reason:'ambiguous_brand'};
  const {brand,alias}=best[0], suffix=key.slice(alias.length), icon=brand.icon.split('/').pop().replace('.png','');
  const isFacility=(icon==='mall'||icon==='departmentstore')&&!specific[brand.id];
  if(embedded.test(suffix)||embedded.test(normalize(branch)))return {status:'review',brand,reason:'non_store_or_embedded_business'};
  const pattern=specific[brand.id]||rules[icon];
  if(!label||!pattern?.test(label))return {status:'review',brand,reason:isFacility?'facility_tenant_or_category':'category_mismatch'};
  if(suffix&&(!/^[가-힣0-9a-z]{1,48}$/.test(suffix)||!branchEnding.test(suffix)))return {status:'review',brand,reason:'unconfirmed_branch_suffix'};
  // Generic names can overlap unrelated businesses, even when categories agree.
  if(generic.has(brand.id))return {status:'review',brand,reason:'generic_brand_name'};
  return {status:'accepted',brand,reason:suffix?'brand_branch_category':'brand_exact_category'};
 };
 return {assess,match:(name,category,branch)=>{const a=assess(name,category,branch);return a.status==='accepted'?a.brand:null;}};
}
export function qualityMerchant(raw,quality){
 const a=quality.assess(raw.bizesNm,raw,raw.brchNm);
 if(a.status!=='accepted')return {...a,row:null};
 const row=publicMerchant(raw,()=>a.brand);
 return row?{...a,row}:{status:'review',brand:a.brand,reason:'invalid_source_record',row:null};
}
// Read-only duplicate candidates; different source IDs never imply safe deletion.
export function duplicateCandidates(rows){
 const groups=new Map();
 for(const row of rows){if(!row.address||!row.name||!row.brand_id)continue;const k=JSON.stringify([row.brand_id,normalize(row.name),normalize(row.address)]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);}
 return [...groups.values()].filter(g=>g.length>1).map(g=>({brand_id:g[0].brand_id,name:g[0].name,address:g[0].address,ids:g.map(r=>r.id),nearby:g.every(r=>Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lng))&&metersBetween({lat:Number(g[0].lat),lng:Number(g[0].lng)},{lat:Number(r.lat),lng:Number(r.lng)})<=30)}));
}

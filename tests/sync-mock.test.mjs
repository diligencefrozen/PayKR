import assert from 'node:assert/strict';
import {transition} from '../scripts/merchants/plan.mjs';
import {parseCategoryCodes} from '../scripts/merchants/fetch-category-codes.mjs';
const started='2026-11-29';
assert.equal(transition({started,region:0,page:511,complete:false}).end,1);
assert.equal(transition({started,region:2,page:1,complete:false}).end,2);
assert.equal(transition({started,region:0,page:1,complete:false}).replay.complete,true);
assert.equal(transition({started,region:17,page:1,complete:true},{started,region:4,page:2,complete:false}).replay.region,4);
assert.deepEqual(parseCategoryCodes({header:{resultCode:'00'},body:{items:[{indsSclsCd:'I20102',indsSclsNm:'국/탕/찌개류'}]}}),{I20102:'국/탕/찌개류'});
const state=new Map([['initial',{started,region:1,page:1,complete:false}]]), merchants=new Map();let publicCalls=0,schema=5;
Object.assign(process.env,{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test',PUBLIC_DATA_API_KEY:'fake',PAYKR_MAX_PAGES:'2'});
const raw={bizesId:'MA0001',bizesNm:'GS25',brchNm:'테스트점',indsMclsNm:'종합소매',indsSclsNm:'편의점',lat:37.55,lon:127,rdnmAdr:'서울 테스트로 1',ctprvnCd:'11'};
merchants.set('BAD',{id:'BAD',quality_status:'legacy',active:true});
const res=x=>new Response(JSON.stringify(x),{status:200});
globalThis.fetch=async(url,o={})=>{
 const u=new URL(url),body=o.body?JSON.parse(o.body):null;
 if(u.hostname==='apis.data.go.kr'){
  publicCalls++;const isDelta=u.pathname.endsWith('storeListByDate');
  const items=isDelta?[{...raw,rdnmAdr:'서울 테스트로 2',chgGb:'U'},{bizesId:'MA0001',chgGb:'D'}]:u.searchParams.get('key')==='11'?[raw,{...raw,bizesId:'BAD',bizesNm:'현대아울렛볼빅 가산점',indsSclsNm:'의류'}]:[];
  return res({header:{resultCode:'00'},body:{items,totalCount:items.length,numOfRows:1000,pageNo:1}});
 }
 if(u.pathname.endsWith('paykr_quality_schema'))return res(schema);
 if(u.pathname.endsWith('paykr_db_bytes'))return res(1024);
 if(u.pathname.endsWith('paykr_upsert_merchants')){for(const r of body.p_rows)merchants.set(r.id,{...r,quality_status:'accepted'});return res(null);}
 if(u.pathname.endsWith('paykr_mark_merchant_review')){for(const r of body.p_rows)if(merchants.has(r.id))merchants.get(r.id).quality_status='review';return res(null);}
 if(u.pathname.endsWith('paykr_sync_state')){if(o.method==='POST'){state.set(body.id,body.value);return res(null);}const id=u.searchParams.get('id').slice(3);return res(state.has(id)?[{value:state.get(id)}]:[]);}
 throw Error('Unexpected request '+u.pathname);
};
process.argv[2]='auto';schema=4;await assert.rejects(import('../scripts/merchants/sync.mjs?run=0'),/Apply v0.5/);assert.equal(publicCalls,0);assert(!state.has('quality_v5_plan'));schema=5;
await import('../scripts/merchants/sync.mjs?run=1');assert.equal(state.get('initial').region,3);assert.equal(state.get('quality_v5_plan').end,1);
process.env.PAYKR_MAX_PAGES='30';await import('../scripts/merchants/sync.mjs?run=2');assert.equal(state.get('initial').complete,true);assert.equal(publicCalls,16);
await import('../scripts/merchants/sync.mjs?run=3');assert.equal(state.get('quality_v5_plan').replay.complete,true);assert.equal(publicCalls,17);assert.equal(merchants.get('BAD').quality_status,'review');assert.equal(merchants.get('BAD').active,true);
const yesterday=new Date(Date.now()+9*3600000-86400000).toISOString().slice(0,10);state.set('delta',{day:yesterday,page:1});await import('../scripts/merchants/sync.mjs?run=4');assert.equal(merchants.get('MA0001').address,'서울 테스트로 2');assert.equal(merchants.get('MA0001').active,true);assert(state.has('delta_recheck_v5'));
console.log('PASS: targeted replay, schema guard, resume, existing row review, official code parser and rolling delta');

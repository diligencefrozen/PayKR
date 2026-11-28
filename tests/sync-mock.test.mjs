import assert from 'node:assert/strict';
// Exercise the production import script against mocked HTTP responses, with resume across runs.
const state=new Map(), merchants=new Map();let publicCalls=0;
Object.assign(process.env,{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test',PUBLIC_DATA_API_KEY:'fake',PAYKR_MAX_PAGES:'2'});
const raw={bizesId:'MA0001',bizesNm:'GS25',brchNm:'테스트점',indsMclsNm:'종합소매',indsSclsNm:'편의점',lat:37.55,lon:127,rdnmAdr:'서울 테스트로 1',ctprvnCd:'11'};
const res=x=>new Response(JSON.stringify(x),{status:200});
globalThis.fetch=async(url,o={})=>{
 const u=new URL(url), body=o.body?JSON.parse(o.body):null;
 if(u.hostname==='apis.data.go.kr'){
  publicCalls++;
  const isDelta=u.pathname.endsWith('storeListByDate');
  const items=isDelta?[{...raw,rdnmAdr:'서울 테스트로 2',chgGb:'U'},{bizesId:'MA0001',chgGb:'D'}]:u.searchParams.get('key')==='11'?[raw]:[];
  return res({header:{resultCode:'00'},body:{items,totalCount:items.length,numOfRows:1000,pageNo:1}});
 }
 assert.equal(u.hostname,'example.supabase.co');
 if(u.pathname.endsWith('paykr_db_bytes'))return res(1024);
 if(u.pathname.endsWith('paykr_upsert_merchants')){for(const r of body.p_rows)merchants.set(r.id,r);return res(null);}
 if(u.pathname.endsWith('paykr_sync_state')){
  if(o.method==='POST'){state.set(body.id,body.value);return res(null);}
  const id=u.searchParams.get('id').slice(3);return res(state.has(id)?[{value:state.get(id)}]:[]);
 }
 throw Error('Unexpected request');
};
process.argv[2]='initial';await import('../scripts/merchants/sync.mjs?run=1');
assert.equal(state.get('initial').region,2);assert.equal(merchants.size,1);assert.equal(publicCalls,2);
process.env.PAYKR_MAX_PAGES='30';await import('../scripts/merchants/sync.mjs?run=2');
assert.equal(state.get('initial').complete,true);assert.equal(publicCalls,17);assert.equal(merchants.size,1);
// Move cursor to yesterday to simulate a scheduled daily run.
const yesterday=new Date(Date.now()+9*3600000-86400000).toISOString().slice(0,10);
state.set('delta',{day:yesterday,page:1});process.argv[2]='delta';await import('../scripts/merchants/sync.mjs?run=3');
assert.equal(merchants.get('MA0001').address,'서울 테스트로 2');assert.equal(merchants.get('MA0001').active,true);
console.log('PASS: initial pagination checkpoints, resumed baseline, delta upsert, unknown deletion safety');

import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {qualityMatcher,qualityMerchant,QUALITY_VERSION} from '../../src/models/merchant-quality.js';
import {createClients} from './client.mjs';
import {transition,validateCursor} from './plan.mjs';
const brands=JSON.parse(await readFile(new URL('../../src/data/stores.json',import.meta.url)));
const codeLabels=JSON.parse(await readFile(new URL('./category-codes.json',import.meta.url)));
const quality=qualityMatcher(brands,{codeLabels});
const reviewReasons={}; const observedCodeLabels=new Map();
const regions=['11','26','27','28','29','30','31','36','41','43','44','46','47','48','50','51','52'];
const koreaDay=(ms=Date.now())=>new Date(ms+9*3600000).toISOString().slice(0,10);
const plusDay=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
let mode=process.argv[2]||'auto';
const {db,publicPage}=createClients();
const maxPages=Number(process.env.PAYKR_MAX_PAGES||500);
if(!Number.isInteger(maxPages)||maxPages<1||maxPages>5000)throw Error('Invalid PAYKR_MAX_PAGES');
const state=async id=>(await db('paykr_sync_state?select=value&id=eq.'+id))?.[0]?.value;
const save=(id,value)=>db('paykr_sync_state?on_conflict=id',{method:'POST',body:{id,value,updated_at:new Date().toISOString()},prefer:'resolution=merge-duplicates,return=minimal'});
let pages=0,seen=0,saved=0,ignored=0,unknownChange=0;
const budget=async()=>{const bytes=await db('rpc/paykr_db_bytes',{method:'POST',body:{}});if(!Number.isFinite(Number(bytes))||Number(bytes)>420*1024*1024)throw Error('Database exceeds safety threshold (420 MiB); inspect usage before continuing');};
async function apply(items,changeDay=null){
 const mapped=new Map(), reviews=new Map();
 for(const raw of items){
  seen++;
  if(changeDay&&!['C','U'].includes(raw.chgGb)){unknownChange++;continue;}
  if(raw.indsSclsCd&&raw.indsSclsNm){const code=String(raw.indsSclsCd),label=String(raw.indsSclsNm);if(/^[A-Za-z0-9_-]{1,30}$/.test(code)&&label.length<=100){if(!observedCodeLabels.has(code))observedCodeLabels.set(code,new Set());observedCodeLabels.get(code).add(label);}}
  const a=qualityMerchant(raw,quality), id=String(raw.bizesId||'');
  if(a.row){mapped.set(a.row.id,{...a.row,source_change_day:changeDay});reviews.delete(a.row.id);}
  else {ignored++;if(/^[A-Za-z0-9_-]{1,40}$/.test(id)&&!mapped.has(id))reviews.set(id,a.reason);if(a.status==='review')reviewReasons[a.reason]=(reviewReasons[a.reason]||0)+1;}
 }
 const rows=[...mapped.values()];
 for(let i=0;i<rows.length;i+=200){await db('rpc/paykr_upsert_merchants',{method:'POST',body:{p_rows:rows.slice(i,i+200)}});saved+=rows.slice(i,i+200).length;}
 // Only existing rows get a review flag; unmatched source records are never inserted.
 if(reviews.size)await db('rpc/paykr_mark_merchant_review',{method:'POST',body:{p_rows:[...reviews].map(([id,reason])=>({id,reason,source_change_day:changeDay}))}});
}
async function scan(endpoint,params,start,onPage,delta=false){
 let page=start||1;
 while(pages<maxPages){
  const result=await publicPage(endpoint,{...params,numOfRows:1000,pageNo:page});
  await apply(result.items,delta?params.key.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'):null);pages++;
  const done=page*result.size>=result.total;
  await onPage(done?null:page+1);
  if(pages%50===0)await budget();
  if(done)return true;page++;
 }return false;
}
if(!['auto','resume','initial','quality','delta'].includes(mode))throw Error('Use auto, resume, initial, quality or delta');
// Fail before advancing any checkpoint if migration not installed.
if(await db('rpc/paykr_quality_schema',{method:'POST',body:{}})!==5)throw Error('Apply v0.5 SQL migration first');
let initial=validateCursor(await state('initial')||{started:koreaDay(),region:0,page:1,complete:false});
const planKey='quality_v5_plan';
let plan=await state(planKey);
const rulesHash=createHash('sha256').update(JSON.stringify(codeLabels)).update(await readFile(new URL('../../src/models/merchant-quality.js',import.meta.url))).update(await readFile(new URL('../../src/data/stores.json',import.meta.url))).digest('hex');
if(!plan){plan={...transition(initial,await state('quality_'+QUALITY_VERSION)),rulesHash};await save(planKey,plan);}
if(plan.rulesHash!==rulesHash)throw Error('Matching rules changed during v0.5 plan; operator migration required');
if(!Number.isInteger(plan.end)||plan.end<0||plan.end>regions.length||!Number.isInteger(plan.replay?.region)||plan.replay.region<0||plan.replay.region>plan.end||!Number.isInteger(plan.replay.page)||plan.replay.page<1||plan.replay.complete!==(plan.replay.region===plan.end))throw Error('Invalid quality replay plan');
if(mode==='auto'||mode==='resume'){
 if(!initial.complete)mode='initial';else if(!plan.replay.complete)mode='quality';else if(mode==='resume'){console.log('Initial and quality replay complete.');process.exit(0);}else mode='delta';
 console.log('Selected sync mode:',mode);
}
await budget();
if(mode==='initial'||mode==='quality'){
 if(mode==='quality'&&!initial.complete)throw Error('Finish initial before targeted quality replay');
 let s=mode==='initial'?initial:plan.replay, end=mode==='initial'?regions.length:plan.end;
 if(s.complete){console.log(mode+' scan already complete.');process.exit(0);}
 const checkpoint=async()=>{if(mode==='initial')await save('initial',s);else {plan={...plan,replay:s};await save(planKey,plan);}};
 await checkpoint();
 while(s.region<end&&pages<maxPages){
  await scan('storeListInDong',{divId:'ctprvnCd',key:regions[s.region]},s.page,async next=>{s=next?{...s,page:next}:{...s,region:s.region+1,page:1,complete:s.region+1===end};await checkpoint();});
  console.log('Province progress:',s.region,'/',end,'next page',s.page);
 }
 if(s.complete){if(!await state('delta'))await save('delta',{day:initial.started,page:1});console.log(mode==='quality'?'Targeted quality replay complete. Run delta and review flagged records.':'Initial scan complete. Finish targeted quality replay before delta.');}
}else{
 if(!initial.complete||!plan.replay.complete)throw Error('Complete initial and targeted quality replay before delta');
 let s=await state('delta')||{day:initial.started,page:1};const yesterday=plusDay(koreaDay(),-1);
 while(s.day<=yesterday&&pages<maxPages){const day=s.day;await scan('storeListByDate',{key:day.replaceAll('-','')},s.page,async next=>{s=next?{day,page:next}:{day:plusDay(day,1),page:1};await save('delta',s);},true);}
 // A separate rolling replay cursor avoids restarting a large day every run.
 if(s.day>yesterday&&pages<maxPages){
  const first=plusDay(yesterday,-2);let r=await state('delta_recheck_v5');
  if(!r||r.day<first||r.day>yesterday)r={day:first,page:1};
  while(r.day<=yesterday&&pages<maxPages){const day=r.day;await scan('storeListByDate',{key:day.replaceAll('-','')},r.page,async next=>{r=next?{day,page:next}:{day:plusDay(day,1),page:1};await save('delta_recheck_v5',r);},true);}
 }
}
console.log(JSON.stringify({pages,seen,matchedUpserts:saved,ignored,unknownChange,matchingVersion:QUALITY_VERSION,reviewReasons,replayEnd:plan.end}));
console.log('Observed source category codes:',JSON.stringify(Object.fromEntries([...observedCodeLabels].map(([code,labels])=>[code,[...labels]]))));
await budget();
if(unknownChange)console.warn('Unknown change codes skipped; no automatic closure inference.');

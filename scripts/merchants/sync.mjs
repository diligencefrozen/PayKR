import {readFile} from 'node:fs/promises';
import {matcher,publicMerchant} from '../../src/models/merchant-match.js';
import {createClients} from './client.mjs';
const brands=JSON.parse(await readFile(new URL('../../src/data/stores.json',import.meta.url)));
const match=matcher(brands);
// Current province codes; use operator review if a public source changes administrative codes.
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
async function apply(items,delta=false){
  const mapped=new Map();
  for(const raw of items){
    seen++;
    if(delta&&!['C','U'].includes(raw.chgGb)){unknownChange++;continue;}
    const row=publicMerchant(raw,match);if(row)mapped.set(row.id,row);else ignored++;
  }
  const rows=[...mapped.values()];
  for(let i=0;i<rows.length;i+=200){await db('rpc/paykr_upsert_merchants',{method:'POST',body:{p_rows:rows.slice(i,i+200)}});saved+=rows.slice(i,i+200).length;}
  // Nonmatching or missing rows are not automatic deletions. No documented D code in supplied guide.
}
async function scan(endpoint,params,start,onPage,delta=false){
  let page=start||1;
  while(pages<maxPages){
    const result=await publicPage(endpoint,{...params,numOfRows:1000,pageNo:page});
    await apply(result.items,delta);pages++;
    const done=page*result.size>=result.total;
    await onPage(done?null:page+1);
    if(pages%50===0)await budget();
    if(done)return true;
    page++;
  }return false;
}
if(mode==='auto'||mode==='resume'){
  const initial=await state('initial');
  if(mode==='resume'&&initial?.complete){console.log('Initial import complete; no resume needed.');process.exit(0);}
  mode=initial?.complete?'delta':'initial';
  console.log('Selected sync mode:',mode);
}
await budget();
if(mode==='initial'){
  let s=await state('initial')||{started:koreaDay(),region:0,page:1,complete:false};
  if(s.complete){console.log('Initial import already complete. Use delta.');process.exit(0);}
  await save('initial',s);
  while(s.region<regions.length&&pages<maxPages){
    const current=regions[s.region];
    await scan('storeListInDong',{divId:'ctprvnCd',key:current},s.page,async next=>{
      s=next?{...s,page:next}:{...s,region:s.region+1,page:1,complete:s.region+1===regions.length};
      await save('initial',s);
    });
    console.log('Province progress:',s.region,'/',regions.length,'next page',s.page);
  }
  if(s.complete){if(!await state('delta'))await save('delta',{day:s.started,page:1});console.log('Initial scan complete. Run delta catch-up before enabling DB mode.');}
}else if(mode==='delta'){
  const initial=await state('initial');if(!initial?.complete){console.log('Initial scan incomplete: run initial first.');process.exit(0);}
  let s=await state('delta')||{day:initial.started,page:1};
  const yesterday=plusDay(koreaDay(),-1);
  while(s.day<=yesterday&&pages<maxPages){
    const day=s.day;
    await scan('storeListByDate',{key:day.replaceAll('-','')},s.page,async next=>{
      s=next?{day,page:next}:{day:plusDay(day,1),page:1};await save('delta',s);
    },true);
    console.log('Delta cursor:',s.day,'page',s.page);
  }
  // Recheck yesterday after catch-up to accommodate late publication, without advancing cursor backwards.
  if(s.day>yesterday&&pages<maxPages)await scan('storeListByDate',{key:yesterday.replaceAll('-','')},1,async()=>{},true);
}else throw Error('Use auto, resume, initial or delta');
console.log(JSON.stringify({pages,seen,matchedUpserts:saved,ignored,unknownChange}));
await budget();
if(unknownChange)console.warn('Unknown change codes skipped; review authoritative deletion semantics before changing inactive status.');

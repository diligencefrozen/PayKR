import assert from 'node:assert/strict';
import { viewportCells,viewportPage } from '../src/models/spatial-cache.js';
import { MerchantVersion } from '../src/infrastructure/cache/merchant-version.js';
import { MerchantCache } from '../src/infrastructure/cache/merchant-cache.js';
import { MerchantSearch } from '../src/services/merchant-search.js';
const bounds=[37.001,127.001,37.004,127.004];
assert.deepEqual(viewportCells(bounds),[[37,127,37.005,127.005]]);
assert.equal(viewportCells([36,126,38,128]),null);
assert.equal(viewportCells([37,127,36,128]),null);
const row=(id,lat,lng,brand_id='a')=>({id:String(id),lat,lng,brand_id,name:'shop '+id});
const rows=[row(1,37.002,127.002),row(2,37.003,127.003,'b'),row(3,37.0049,127.0049)];
assert.equal(viewportPage([{rows,stale:false},{rows,stale:false}],bounds,0).rows.length,2);
assert.equal(viewportPage([{rows:Array(61).fill(rows[0]),stale:false}],bounds,0),null);
let now=0,version='1',versionCalls=0,networkCalls=0,dense=false,down=false;
const persisted=new Map(),meta=new Map();
const store={readSnapshot:async k=>({record:persisted.get(k),epoch:0}),write:async(k,r)=>persisted.set(k,r)};
const brands=[{id:'a',names:{ko:'A'},aliases:[],icon:'a.png'},{id:'b',names:{ko:'B'},aliases:[],icon:'b.png'}];
const catalog={query:async(_,c)=>c==='a'?[brands[0]]:brands};
const cache=new MerchantCache(store,{clock:()=>now});
const service=new MerchantSearch({url:'https://example.supabase.co',publishableKey:'sb_publishable_test'},catalog,{},[],async(url,o)=>{
 if(url.endsWith('paykr_merchant_version')){versionCalls++;if(down)throw Error('down');return new Response(JSON.stringify(version));}
 networkCalls++;if(down)throw Error('down');const p=JSON.parse(o.body);
 const data=dense?Array.from({length:125},(_,i)=>row(i,37.002,127.002,i%2?'a':'b')):rows;
 return new Response(JSON.stringify(data.filter(r=>r.lat>=p.p_south&&r.lat<=p.p_north&&r.lng>=p.p_west&&r.lng<=p.p_east&&(!p.p_brand_ids||p.p_brand_ids.includes(r.brand_id))).slice(p.p_offset,p.p_offset+p.p_limit)));
},cache);
service.version=new MerchantVersion(service.config.url,()=>service.rpc('paykr_merchant_version',{}),{clock:()=>now,storage:{getItem:k=>meta.get(k),setItem:(k,v)=>meta.set(k,v)}});
assert.equal((await service.search({bounds})).items.length,2);assert.equal(networkCalls,1);
assert.equal((await service.search({bounds:[37.0015,127.0015,37.0035,127.0035],category:'a'})).items.length,1);assert.equal(networkCalls,1);assert.equal(versionCalls,1);
assert.equal(persisted.size,1);version='2';now+=300001;
await service.search({bounds,privateViewport:true,nearby:true});assert.equal(networkCalls,2);assert.equal(persisted.size,1);assert.equal(versionCalls,2);
now+=300001;down=true;assert.equal((await service.search({bounds,privateViewport:true})).items.length,2);assert.equal(networkCalls,2);assert.equal(versionCalls,3);
down=false;version='3';dense=true;now+=300001;
const first=await service.search({bounds}),second=await service.search({bounds,offset:12}),third=await service.search({bounds,offset:24});
assert.equal(first.items.length,60);assert.equal(second.items.length,60);assert.equal(third.items.length,5);assert(first.more&&second.more&&!third.more);
assert.equal(new Set([...first.items,...second.items,...third.items].map(r=>r.id)).size,125);
assert.equal(networkCalls,6); // one dense cell, then three exact pages
const v=new MerchantVersion('test',async()=>{throw Error('not installed');},{clock:()=>now});assert.equal(await v.get(),'legacy');
let checks=0;const coalesced=new MerchantVersion('other',async()=>{checks++;return '42';},{clock:()=>now});assert.deepEqual(await Promise.all([coalesced.get(),coalesced.get()]),['42','42']);assert.equal(checks,1);
console.log('PASS: spatial reuse across viewport/category, boundary dedup, large/dense fallback, private GPS memory-only, version invalidation/coalescing and offline fallback');
// New version detected, but search RPC fails: old version is stale, never a fresh hit.
let failSearch=false,ver='10',ticks=0;
const oldCache=new MerchantCache(undefined,{clock:()=>ticks});
const svc=new MerchantSearch(service.config,catalog,{},[],async(url,o)=>{if(url.endsWith('paykr_merchant_version'))return new Response(JSON.stringify(ver));if(failSearch)throw Error('offline');return new Response(JSON.stringify(rows));},oldCache);
svc.version=new MerchantVersion('previous-test',()=>svc.rpc('paykr_merchant_version',{}),{clock:()=>ticks,storage:{getItem:()=>null,setItem:()=>{}}});
assert.equal((await svc.search({bounds})).stale,false);ver='11';ticks=300001;failSearch=true;assert.equal((await svc.search({bounds})).stale,true);assert.equal(oldCache.snapshot().stale,1);

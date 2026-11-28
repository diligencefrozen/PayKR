import { normalize, paymentFor } from '../models/payment.js';
import { keywordFor } from './search.js';
import { compareLive } from '../models/merchant-match.js';
import { MerchantCache } from '../infrastructure/cache/merchant-cache.js';
import { MerchantVersion } from '../infrastructure/cache/merchant-version.js';
import { viewportCells, viewportPage } from '../models/spatial-cache.js';
import { VERSION } from '../data/catalog-version.js';
export class MerchantSearch {
  dbMode=true;
  constructor(config,catalog,provider,claims=[],fetcher=fetch,cache=new MerchantCache()){Object.assign(this,{config,catalog,provider,claims,fetcher,cache});this.epoch=0;this.verifiedCount=0;this.pending=new Map();this.version=new MerchantVersion(config.url,()=>this.rpc('paykr_merchant_version',{},3000));}
  async rpc(name,params,timeout=10000){
    const key=this.config.publishableKey;
    const response=await this.fetcher(this.config.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{})},body:JSON.stringify(params),signal:AbortSignal.timeout(timeout)});
    if(!response.ok)throw Error('DB search unavailable');
    return response.json();
  }
  cancel(){this.epoch++;} // Shared requests finish under their own timeout; obsolete results never render.
  async search({input='',brand=null,category='all',bounds=null,offset=0,page=1,nearby=false,privateViewport=nearby}){
    this.cancel();const epoch=this.epoch;
    const all=await this.catalog.query('stores',category);if(epoch!==this.epoch)return null;
    const exact=brand||all.find(b=>[...Object.values(b.names),...b.aliases].some(n=>normalize(n)===normalize(input)&&input));
    const q=exact?'':normalize(keywordFor(input,all));
    const skip=(input?page-1:Math.floor(offset/12))*60;
    if(skip>10000)return {items:[],errors:0,more:false,limited:true};
    const params={p_brand_ids:exact?[exact.id]:category==='all'?null:all.map(b=>b.id),p_query:q,p_offset:skip,p_limit:61};
    if(bounds){[params.p_south,params.p_west,params.p_north,params.p_east]=bounds;}
    try{
      const version=await this.version.get();if(epoch!==this.epoch)return null;
      const persist=!input&&!privateViewport&&Boolean(bounds);
      const query=(p,kind)=>this.cache.get(JSON.stringify(['merchant-v3',VERSION,version,this.config.url,kind,p]),()=>this.rpc('paykr_search_merchants',p),{persist});
      let result=null;
      // Small, unfiltered map views only. Reuse all-category cells for category filters.
      // GPS-derived cells can use memory, but never durable storage.
      const cells=!input&&!exact&&bounds?viewportCells(bounds):null;
      if(cells){
        try{
          const pages=await Promise.all(cells.map(([s,w,n,e])=>query({p_brand_ids:null,p_query:'',p_offset:0,p_limit:61,p_south:s,p_west:w,p_north:n,p_east:e},'cell')));
          // Check truncation BEFORE filtering, or dense cells could hide a selected brand.
          if(pages.every(p=>p.rows.length<61)){
            const allowed=new Set(all.map(b=>b.id));
            result=viewportPage(pages.map(p=>({...p,rows:p.rows.filter(r=>allowed.has(r.brand_id))})),bounds,skip);
          }
        }catch{/* Exact-query cache is an independent fallback. */}
      }
      if(epoch!==this.epoch)return null;
      const {rows,stale}=result??await query(params,'exact');
      if(epoch!==this.epoch)return null;
      const brands=new Map(all.map(b=>[b.id,b]));
      const items=rows.slice(0,60).flatMap(row=>{
        const b=brands.get(row.brand_id);const lat=Number(row.lat),lng=Number(row.lng);
        if(!b||!row.id||!row.name||!Number.isFinite(lat)||!Number.isFinite(lng))return [];
        const id='public:'+row.id;
        return [{id,source:'public',name:row.name,address:row.address||'',category:row.category||'',lat,lng,phone:'',icon:b.icon,claim:paymentFor(id,b,this.claims)}];
      });
      return {items,errors:stale?1:0,stale,failed:false,limited:skip>=9960&&rows.length>60,more:skip<9960&&rows.length>60};
    }catch(e){if(epoch!==this.epoch)return null;throw e;}
  }
  // Explicit detail-only live comparison; no durable cache and no payment claim upgrade.
  verify(place){
    if(this.pending.has(place.id))return this.pending.get(place.id);
    if(this.verifiedCount>=10)return Promise.resolve('limit');
    this.verifiedCount++;
    const job=(async()=>{
      const brands=await this.catalog.query('stores');
      const delta=.003;
      const result=await this.provider.search(place.name,[place.lat-delta,place.lng-delta,place.lat+delta,place.lng+delta],1);
      return compareLive(place,result.rows,brands);
    })().catch(()=> 'error').finally(()=>this.pending.delete(place.id));
    this.pending.set(place.id,job);return job;
  }
}

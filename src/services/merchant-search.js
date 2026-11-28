import { normalize, paymentFor } from '../models/payment.js';
import { keywordFor } from './search.js';
import { compareLive } from '../models/merchant-match.js';
import { MerchantCache } from '../infrastructure/cache/merchant-cache.js';
import { VERSION } from '../data/catalog-version.js';
export class MerchantSearch {
  dbMode=true;
  constructor(config,catalog,provider,claims=[],fetcher=fetch,cache=new MerchantCache()){Object.assign(this,{config,catalog,provider,claims,fetcher,cache});this.epoch=0;this.verifiedCount=0;this.pending=new Map();}
  cancel(){this.epoch++;} // Shared requests finish under their own timeout; obsolete results never render.
  async search({input='',brand=null,category='all',bounds=null,offset=0,page=1,nearby=false,privateViewport=false}){
    this.cancel();const epoch=this.epoch;
    const all=await this.catalog.query('stores',category);if(epoch!==this.epoch)return null;
    const exact=brand||all.find(b=>[...Object.values(b.names),...b.aliases].some(n=>normalize(n)===normalize(input)&&input));
    const q=exact?'':normalize(keywordFor(input,all));
    const skip=(input?page-1:Math.floor(offset/12))*60;
    if(skip>10000)return {items:[],errors:0,more:false,limited:true};
    const params={p_brand_ids:exact?[exact.id]:category==='all'?null:all.map(b=>b.id),p_query:q,p_offset:skip,p_limit:61};
    if(bounds){[params.p_south,params.p_west,params.p_north,params.p_east]=bounds;}
    const cacheKey=JSON.stringify(['merchant-v2',VERSION,this.config.url,params]);
    try{
      const {rows,stale}=await this.cache.get(cacheKey,async()=>{
        const key=this.config.publishableKey;
        const response=await this.fetcher(this.config.url.replace(/\/$/,'')+'/rest/v1/rpc/paykr_search_merchants',{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{})},body:JSON.stringify(params),signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw Error('DB search unavailable');
        return response.json();
      },{persist:!input&&!nearby&&!privateViewport&&Boolean(bounds)});
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

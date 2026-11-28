import { CatalogStore } from './catalog-store.js';
// Separate, disposable IndexedDB region; does not touch catalog or Kakao data.
const EPOCH='invalidation';
export class MerchantStore extends CatalogStore {
  constructor(factory,scope){super(factory,scope+':merchant-pages-v2');}
  readSnapshot(key){return this.transaction('readonly',store=>{
    const value=store.get(key),epoch=store.get(EPOCH);
    return ()=>({record:value.result,epoch:epoch.result||0});
  });}
  write(key,record,expectedEpoch){return this.transaction('readwrite',store=>{
    const epoch=store.get(EPOCH);
    epoch.onsuccess=()=>{
      if((epoch.result||0)!==expectedEpoch)return;
      store.put(record,key);
      const all=store.getAll(),keys=store.getAllKeys();
      keys.onsuccess=()=>{
        const entries=keys.result.map((k,i)=>({k,r:all.result[i]})).filter(e=>e.k!==EPOCH);
        // Oldest insertion first; max 96 pages and 7-day hard expiry.
        entries.sort((a,b)=>(a.r?.savedAt||0)-(b.r?.savedAt||0));
        for(const e of entries.filter((e,i)=>i<entries.length-96||e.r?.staleUntil<=Date.now()))store.delete(e.k);
      };
    };
  });}
}

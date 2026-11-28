import { MemoryCache } from './memory.js';
const DAY=86400000;
export function validPage(rows){return Array.isArray(rows)&&rows.length<=61&&rows.every(r=>r&&typeof r.id==='string'&&typeof r.brand_id==='string'&&typeof r.name==='string'&&Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lng)));}
export class MerchantCache {
  constructor(storage,{clock=Date.now}={}){
    Object.assign(this,{storage,clock});this.memory=new MemoryCache(64,7*DAY,clock);this.pending=new Map();this.generation=0;
    this.metrics={l1:0,l2:0,source:0,merged:0,stale:0};
  }
  invalidate(){this.generation++;this.memory.clear();this.pending.clear();}
  async clear(){this.invalidate();try{await this.storage?.clear();}finally{this.invalidate();}}
  valid(record){return record&&Number.isFinite(record.savedAt)&&Number.isFinite(record.expires)&&Number.isFinite(record.staleUntil)&&record.savedAt<=this.clock()&&record.staleUntil>this.clock()&&validPage(record.rows);}
  async get(key,load,{persist=false}={}){
    const hit=this.memory.get(key);
    if(this.valid(hit)&&hit.expires>this.clock()){this.metrics.l1++;return {rows:hit.rows,stale:false};}
    if(this.pending.has(key)){this.metrics.merged++;return this.pending.get(key);}
    const generation=this.generation;
    const job=this.load(key,load,persist,hit,generation);this.pending.set(key,job);
    try{return await job;}finally{if(this.pending.get(key)===job)this.pending.delete(key);}
  }
  // Previous data version is never a fresh hit. Only use on network failure.
  async previous(key,{persist=false}={}){
    const generation=this.generation;let record=this.memory.get(key);
    if(persist)try{const saved=(await this.storage?.readSnapshot(key))?.record;if(this.valid(saved)&&(!this.valid(record)||saved.savedAt>record.savedAt))record=saved;}catch{}
    if(generation===this.generation&&this.valid(record)&&record.rows.length){this.metrics.stale++;return {rows:record.rows,stale:true};}
    return null;
  }
  snapshot(){const m={...this.metrics};const total=m.l1+m.l2+m.source;return {...m,hitRate:total?(m.l1+m.l2)/total:0,memoryPages:this.memory.size};}
  async load(key,load,persist,hit,generation){
    let fallback=this.valid(hit)&&hit.rows.length?hit:null,epoch;
    if(persist)try{
      const snapshot=await this.storage?.readSnapshot(key);epoch=snapshot?.epoch;
      const saved=snapshot?.record;
      if(this.valid(saved)){
        if(saved.expires>this.clock()){
          this.metrics.l2++;if(generation===this.generation)this.memory.set(key,saved);
          return {rows:saved.rows,stale:false};
        }
        if(saved.rows.length&&(!fallback||saved.savedAt>fallback.savedAt))fallback=saved;
      }
    }catch{/* Storage unavailable: network remains usable. */}
    try{
      this.metrics.source++;const rows=await load();if(!validPage(rows))throw Error('Invalid DB result');
      const now=this.clock(),record={rows,savedAt:now,expires:now+(rows.length?DAY:600000),staleUntil:now+(rows.length?7*DAY:600000)};
      if(generation===this.generation){
        this.memory.set(key,record);
        if(persist&&epoch!==undefined)try{await this.storage?.write(key,record,epoch);}catch{/* Quota or restricted storage. */}
      }
      return {rows,stale:false};
    }catch(error){
      if(this.valid(fallback)&&generation===this.generation){this.metrics.stale++;return {rows:fallback.rows,stale:true};}
      throw error;
    }
  }
}

// Public, non-location metadata. Coalesce version checks and bound them to one per 5 minutes.
export class MerchantVersion {
  constructor(url,load,{clock=Date.now,storage}={}){
    this.load=load;this.clock=clock;this.key='paykr:merchant-version:'+url;this.checked=-Infinity;
    try{this.storage=storage??globalThis.localStorage;const stored=this.storage?.getItem(this.key);this.version=typeof stored==='string'&&/^\d{1,30}$/.test(stored)?stored:'legacy';const previous=this.storage?.getItem(this.key+':previous');this.previous=typeof previous==='string'&&/^(?:legacy|\d{1,30})$/.test(previous)&&previous!==this.version?previous:null;}catch{this.version='legacy';}
  }
  async get(){
    if(this.pending)return this.pending;
    if(this.clock()-this.checked<300000)return this.version;
    this.pending=(async()=>{
      try{
        const version=await this.load();
        if(typeof version!=='string'||!/^\d{1,30}$/.test(version))throw Error('Invalid merchant version');
        if(version!==this.version){this.previous=this.version;this.version=version;
          try{this.storage?.setItem(this.key+':previous',this.previous);}catch{}
        }
        try{this.storage?.setItem(this.key,version);}catch{/* Private browsing. */}
      }catch{/* Missing migration or DB offline: preserve last known cache namespace. */}
      finally{this.checked=this.clock();}
      return this.version;
    })();
    try{return await this.pending;}finally{this.pending=null;}
  }
}

const endpoint='https://apis.data.go.kr/B553077/api/open/sdsc2';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function publicUrl(path,params,key){
  const u=new URL(endpoint+'/'+path); const raw=/%[0-9a-f]{2}/i.test(key)?decodeURIComponent(key):key;
  for(const [k,v] of Object.entries({...params,type:'json',serviceKey:raw}))u.searchParams.set(k,String(v));
  return u;
}
export function parsePublic(payload){
  const r=payload?.response||payload,header=r?.header,body=r?.body;
  if(String(header?.resultCode)!=='00' || !body)throw Error('Public API application error');
  const raw=body.items?.item??body.items;
  const items=Array.isArray(raw)?raw:raw&&typeof raw==='object'&&Object.keys(raw).length?[raw]:[];
  const total=Number(body.totalCount),size=Number(body.numOfRows),page=Number(body.pageNo);
  if(!Number.isInteger(total)||total<0||!Number.isInteger(size)||size<1||!Number.isInteger(page)||page<1)throw Error('Invalid pagination');
  if(items.length!==Math.max(0,Math.min(size,total-(page-1)*size)))throw Error('Incomplete public data page');
  if(items.some(x=>!x||typeof x!=='object'||!x.bizesId))throw Error('Invalid public data row');
  return {items,total,size,page};
}
export async function request(url,options={},fetcher=fetch){
  for(let i=0;i<3;i++){
    try{
      const r=await fetcher(url,{...options,signal:AbortSignal.timeout(30000)});
      if(r.ok){return r;}
      if(r.status!==429&&r.status<500)throw Object.assign(Error('HTTP '+r.status),{permanent:true});
      throw Error('HTTP '+r.status);
    }catch(e){if(e.permanent||i===2)throw Error(e.permanent?e.message:'Network or server failure after retries');await sleep(1000*2**i);}
  }
}
export function createClients(env=process.env,fetcher=fetch){
  const url=String(env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw Error('Set SUPABASE_URL');
  const writeKey=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY;
  const readKey=env.SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const publicKey=env.PUBLIC_DATA_API_KEY;
  const db=async(path,{method='GET',body,key=writeKey,prefer}={})=>{
    if(!key)throw Error('Missing Supabase key');
    const r=await request(url+'/rest/v1/'+path,{method,headers:{apikey:key,'Content-Type':'application/json',...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),...(prefer?{Prefer:prefer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})},fetcher);
    const text=await r.text();return text?JSON.parse(text):null;
  };
  const publicPage=async(path,params)=>{
    if(!publicKey)throw Error('Set PUBLIC_DATA_API_KEY');
    await sleep(120); // below official 30 TPS, single worker
    const r=await request(publicUrl(path,params,publicKey),{},fetcher);
    const data=parsePublic(await r.json());
    if(data.page!==Number(params.pageNo))throw Error('Unexpected page number');
    return data;
  };
  return {db,publicPage,readKey};
}

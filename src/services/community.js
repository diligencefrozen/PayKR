import { communityConfig } from '../config/community.js';
const TOKEN=/^[a-f0-9]{64}$/;
const PUBLIC_ID=/^public:[A-Za-z0-9_-]{1,40}$/;
const KAKAO_ID=/^[1-9][0-9]{0,19}$/;
export function communityId(record){
  if(typeof record?.id!=='string')return null;
  // Preserve existing public-data keys; legacy Kakao cache records have no source.
  if(record.source==='public')return PUBLIC_ID.test(record.id)?record.id.slice(7):null;
  if((record.source==='kakao'||record.source==null)&&KAKAO_ID.test(record.id))return 'kakao:'+record.id;
  return null;
}
function token(create){
  try{
    let value=localStorage.getItem('paykr-community-actor-v1');
    if(TOKEN.test(value||''))return value;
    if(!create)return null;
    value=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem('paykr-community-actor-v1',value);return value;
  }catch{if(create)throw Error('STORAGE');return null;}
}
export async function communityRequest(id,body){
  const base=communityConfig.apiBase;if(!base)throw Error('UNCONFIGURED');
  const auth=token(Boolean(body));const headers={Accept:'application/json'};
  if(auth)headers.Authorization='Bearer '+auth;
  if(body)headers['Content-Type']='application/json';
  const res=await fetch(base.replace(/\/$/,'')+'/api/community/'+encodeURIComponent(id),{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!res.ok){const e=await res.json().catch(()=>({}));throw Error(e.code||'UNAVAILABLE');}return res.json();
}

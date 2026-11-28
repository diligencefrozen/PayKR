import { createTurso } from '../../../scripts/community/turso.mjs';
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const KAKAO_ID = /^kakao:[1-9][0-9]{0,19}$/;
const TOKEN = /^[a-f0-9]{64}$/;
const val = row => row.map(v => v.value ?? null);
const rows = result => (result.rows || []).map(val);
const encoder = new TextEncoder();
async function actorId(secret, token) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(token))), b => b.toString(16).padStart(2,'0')).join('');
}
async function exists(env,id,fetcher) {
  const url = new URL('/rest/v1/paykr_merchants',env.SUPABASE_URL);
  url.search = new URLSearchParams({select:'id',id:'eq.'+id,active:'eq.true',limit:'1'});
  const res = await fetcher(url,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(8000),redirect:'error'});
  if (!res.ok) throw Error('merchant validation failed');
  return (await res.json()).some(row=>row.id===id);
}
async function bodyOf(req) {
  const reader=req.body?.getReader(); if(!reader) throw Error('body missing');
  let size=0, parts=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw Error('body too large');}parts.push(value);}
  const bytes=new Uint8Array(size); let pos=0; for(const p of parts){bytes.set(p,pos);pos+=p.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function handler(fetcher=fetch) {return async (req,env)=>{
  const origin=req.headers.get('Origin');
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
  if(origin===env.ALLOWED_ORIGIN && origin)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(!origin||origin!==env.ALLOWED_ORIGIN)return json({code:'ORIGIN'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  const url=new URL(req.url), match=url.pathname.match(/^\/api\/community\/([^/]+)$/);
  let id;try{id=match&&decodeURIComponent(match[1]);}catch{return json({code:'INVALID_ID'},400);}
  if(!id||(!ID.test(id)&&!KAKAO_ID.test(id)))return json({code:'INVALID_ID'},400);
  const isKakao=KAKAO_ID.test(id);
  if(!['GET','POST'].includes(req.method))return json({code:'METHOD'},405);
  try{
    if(!env.ACTOR_SECRET||env.ACTOR_SECRET.length<32||(!isKakao&&!env.SUPABASE_SERVICE_ROLE_KEY)||!env.READ_LIMIT||!env.WRITE_LIMIT)throw Error('missing settings');
    const ip=req.headers.get('CF-Connecting-IP'); if(!ip)return json({code:'RATE_LIMIT'},429);
    const limiter=req.method==='GET'?env.READ_LIMIT:env.WRITE_LIMIT;
    if(!(await limiter.limit({key:'ip:'+ip})).success)return json({code:'RATE_LIMIT'},429);
    const raw=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
    const actor=TOKEN.test(raw)?await actorId(env.ACTOR_SECRET,raw):null;
    if(req.method==='POST'&&!actor)return json({code:'AUTH_REQUIRED'},401);
    if(req.method==='POST'&&!(await limiter.limit({key:'actor:'+actor})).success)return json({code:'RATE_LIMIT'},429);
    if(!isKakao&&!await exists(env,id,fetcher))return json({code:'NOT_FOUND'},404);
    // Store only a stable, domain-separated opaque key for Kakao places.
    // Keep legacy public IDs intact; do not store Kakao result metadata.
    if(isKakao)id='kakao:'+await actorId(env.ACTOR_SECRET,'place:'+id);
    const sql=createTurso({url:env.TURSO_DATABASE_URL,token:env.TURSO_AUTH_TOKEN,fetcher});
    if(req.method==='GET'){
      const counts=rows(await sql("SELECT outcome, count(*) FROM payment_reports WHERE merchant_id=? AND status='published' GROUP BY outcome",[id]));
      const comments=rows(await sql("SELECT id,nickname,body,created_at,status FROM comments WHERE merchant_id=? AND (status='published' OR (status='pending' AND actor_id=?)) ORDER BY created_at DESC,id DESC LIMIT 50",[id,actor||'']));
      const mine=actor?rows(await sql("SELECT outcome,status FROM payment_reports WHERE merchant_id=? AND actor_id=? AND status!='hidden'",[id,actor]))[0]:null;
      return json({success:Number(counts.find(r=>r[0]==='success')?.[1]||0),failure:Number(counts.find(r=>r[0]==='failure')?.[1]||0),comments:comments.map(([id,nickname,body,createdAt,status])=>({id,nickname,body,createdAt,status})),mine:mine?{outcome:mine[0],status:mine[1]}:null});
    }
    let b;try{b=await bodyOf(req);}catch{return json({code:'INVALID_BODY'},400);}
    if(!b||typeof b!=='object')return json({code:'INVALID_BODY'},400);
    const text=typeof b.body==='string'?b.body.trim():'';
    if(b.type==='payment'&&['success','failure'].includes(b.outcome)){
      const saved=await sql("INSERT INTO payment_reports(id,merchant_id,actor_id,outcome,observed_at) VALUES(?,?,?,?,?) ON CONFLICT(merchant_id,actor_id) DO UPDATE SET outcome=excluded.outcome,observed_at=excluded.observed_at,status='pending' WHERE payment_reports.status!='hidden'",[crypto.randomUUID(),id,actor,b.outcome,new Date().toISOString()]);
      if(saved.affected_row_count===0)return json({code:'FORBIDDEN'},403);
    }else if(b.type==='comment'&&text.length>=1&&text.length<=1000){
      const nickname=typeof b.nickname==='string'?b.nickname.trim():'';
      if(!nickname||nickname.length>40)return json({code:'INVALID_BODY'},400);
      await sql('INSERT INTO comments(id,merchant_id,actor_id,nickname,body) VALUES(?,?,?,?,?)',[crypto.randomUUID(),id,actor,nickname,text]);
    }else if(!isKakao&&b.type==='merchant'&&['closed','moved','incorrect','other'].includes(b.kind)&&text.length>=1&&text.length<=1000){
      await sql('INSERT INTO merchant_reports(id,merchant_id,actor_id,kind,body) VALUES(?,?,?,?,?)',[crypto.randomUUID(),id,actor,b.kind,text]);
    }else return json({code:'INVALID_BODY'},400);
    return json({status:'pending'},201);
  }catch{return json({code:'UNAVAILABLE'},503);}
};}
export default {fetch:handler()};

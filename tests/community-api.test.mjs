import test from 'node:test';
import assert from 'node:assert/strict';
import {handler} from '../workers/community/src/index.mjs';
import {communityId} from '../src/services/community.js';
const origin='https://diligencefrozen.github.io';
const env={ALLOWED_ORIGIN:origin,SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-key',TURSO_DATABASE_URL:'libsql://example.turso.io',TURSO_AUTH_TOKEN:'token',ACTOR_SECRET:'a'.repeat(40),READ_LIMIT:{limit:async()=>({success:true})},WRITE_LIMIT:{limit:async()=>({success:true})}};
const statements=[];
const fetcher=async(url,opts)=>{
  if(String(url).includes('supabase.co'))return Response.json([{id:'m1'}]);
  const statement=JSON.parse(opts.body).requests[0].stmt;statements.push(statement);
  let data=[];
  if(statement.sql.startsWith('SELECT outcome, count'))data=[[{value:'success'},{value:'2'}]];
  if(statement.sql.startsWith('SELECT id,nickname'))data=[[{value:'c1'},{value:'visitor'},{value:'test'},{value:'2026-11-29'},{value:'published'}]];
  return Response.json({results:[{type:'ok',response:{type:'execute',result:{rows:data,affected_row_count:1}}},{type:'ok',response:{type:'close'}}]});
};
const api=handler(fetcher);
const req=(method='GET',body,auth=true,site=origin,id='m1')=>new Request('https://example.workers.dev/api/community/'+id,{method,headers:{Origin:site,'CF-Connecting-IP':'192.0.2.1',...(auth?{Authorization:'Bearer '+'b'.repeat(64)}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
test('public IDs remain compatible; Kakao SDK, REST and cached IDs are namespaced',()=>{
  assert.equal(communityId({source:'public',id:'public:m1'}),'m1');
  assert.equal(communityId({source:'public',id:'public:123'}),'123');
  assert.equal(communityId({source:'kakao',id:'123'}),'kakao:123');
  assert.equal(communityId({id:'123'}),'kakao:123');
  assert.equal(communityId({source:'kakao',id:'m1'}),null);
  assert.equal(communityId({source:'other',id:'123'}),null);
});
test('read returns public projection, no actor secret',async()=>{const r=await api(req(),env);assert.equal(r.status,200);const d=await r.json();assert.equal(d.success,2);assert.equal(d.comments[0].nickname,'visitor');assert.equal(d.comments[0].actor_id,undefined);});
test('write rejects missing capability and invalid input',async()=>{assert.equal((await api(req('POST',{type:'payment',outcome:'success'},false),env)).status,401);assert.equal((await api(req('POST',{type:'comment',nickname:'a',body:' '.repeat(5)}),env)).status,400);});
test('three write routes use bound values and pending status',async()=>{for(const b of [{type:'payment',outcome:'success'},{type:'comment',nickname:'a',body:"it's text"},{type:'merchant',kind:'closed',body:'closed'}]){const r=await api(req('POST',b),env);assert.equal(r.status,201);assert.deepEqual(await r.json(),{status:'pending'});assert.ok(statements.at(-1).sql.startsWith('INSERT'));assert.ok(statements.at(-1).args[2].value.match(/^[a-f0-9]{64}$/));}assert.ok(statements.some(s=>s.args.some(a=>a.value==="it's text")));});
test('origin, unknown merchant, rate limit, DB failures are rejected',async()=>{assert.equal((await api(req('GET',null,false,'https://evil.example'),env)).status,403);assert.equal((await api(req('GET',null,false,origin,'bad/id'),env)).status,400);assert.equal((await api(req(),{...env,READ_LIMIT:{limit:async()=>({success:false})}})).status,429);assert.equal((await handler(async()=>Response.json([]))(req(),env)).status,404);assert.equal((await handler(async()=>new Response('',{status:500}))(req(),env)).status,503);});

test('Kakao reads and reviews bypass Supabase, use the same opaque key, and keep moderation',async()=>{
  const start=statements.length;
  const kakaoApi=handler(async(url,opts)=>{
    assert.ok(!String(url).includes('supabase.co'));
    return fetcher(url,opts);
  });
  const kakaoEnv={...env,SUPABASE_SERVICE_ROLE_KEY:undefined};
  const id=encodeURIComponent('kakao:123');
  assert.equal((await kakaoApi(req('GET',null,false,origin,id),kakaoEnv)).status,200);
  for(const body of [{type:'payment',outcome:'success'},{type:'payment',outcome:'failure'},{type:'comment',nickname:'visitor',body:'My review'}]){
    const response=await kakaoApi(req('POST',body,true,origin,id),kakaoEnv);
    assert.equal(response.status,201);assert.deepEqual(await response.json(),{status:'pending'});
  }
  const used=statements.slice(start);const key=used[0].args[0].value;
  assert.match(key,/^kakao:[a-f0-9]{64}$/);
  for(const statement of used)assert.equal(statement.args[statement.sql.startsWith('INSERT')?1:0].value,key);
  assert.ok(used[0].sql.includes("status='published'"));
  assert.ok(used[1].sql.includes("status='pending' AND actor_id=?"));
  assert.equal((await kakaoApi(req('POST',{type:'merchant',kind:'closed',body:'closed'},true,origin,id),kakaoEnv)).status,400);
  assert.equal((await kakaoApi(req('POST',{type:'payment',outcome:'success'},false,origin,id),kakaoEnv)).status,401);
  assert.equal((await kakaoApi(req('GET',null,false,origin,'kakao%3Abad'),kakaoEnv)).status,400);
  assert.equal((await kakaoApi(req('GET',null,false,origin,'kakao%3A%2F123'),kakaoEnv)).status,400);
  assert.equal((await kakaoApi(req('GET',null,false,origin,'kakao%3A124'),kakaoEnv)).status,200);
  assert.notEqual(statements.at(-1).args[0].value,key);
});

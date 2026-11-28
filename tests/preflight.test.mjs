import assert from 'node:assert/strict';
import {preflight} from '../scripts/merchants/preflight.mjs';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture-secret'};
const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
let ready=false,denied=true;
const fake=async(url,opts)=>{
 const key=opts.headers.apikey;
 const body=opts.body?JSON.parse(opts.body):{};
 let value;
 if(url.endsWith('paykr_quality_schema')){assert.equal(key,env.SUPABASE_SERVICE_ROLE_KEY);value=5;}
 else if(url.endsWith('paykr_merchant_version')){assert.equal(key,env.SUPABASE_PUBLISHABLE_KEY);value='123';}
 else if(url.endsWith('paykr_search_merchants')){assert.equal(key,env.SUPABASE_PUBLISHABLE_KEY);value=body.p_south?[ ]:[{id:'fixture'}];}
 else if(url.includes('paykr_merchants?')){assert.equal(key,env.SUPABASE_PUBLISHABLE_KEY);return new Response('[]',{status:denied?403:200});}
 else if(url.includes('paykr_sync_state?')){assert.equal(key,env.SUPABASE_SERVICE_ROLE_KEY);value=[{id:'initial',value:{region:ready?17:0,page:511,complete:ready}},{id:'quality_v5_plan',value:{end:1,replay:{region:ready?1:0,complete:ready}}},{id:'delta',value:{day:today,page:1}}];}
 else if(url.endsWith('paykr_db_bytes')){assert.equal(key,env.SUPABASE_SERVICE_ROLE_KEY);value=35*1048576;}
 else throw Error('unexpected operation');
 return new Response(JSON.stringify(value));
};
assert.equal((await preflight(env,fake)).technicalGate,false);
ready=true;assert.equal((await preflight(env,fake)).technicalGate,true);
denied=false;await assert.rejects(()=>preflight(env,fake),/direct SELECT/);
console.log('PASS: read-only production preflight, public/private key separation, readiness gate and table access denial');

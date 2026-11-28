import {createClients} from './client.mjs';
import {pathToFileURL} from 'node:url';
// Read-only operational checks. Never print keys, merchant rows or user location.
export async function preflight(env=process.env,fetcher=fetch){
 const {db,readKey}=createClients(env,fetcher);
 if(!readKey||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Missing required Supabase keys');
 const pub=(name,body={})=>db('rpc/'+name,{key:readKey,method:'POST',body});
 const operator=(name)=>db('rpc/'+name,{method:'POST',body:{}});
 const schema=await operator('paykr_quality_schema');
 if(schema!==5)throw Error('Expected v0.5 quality schema');
 const version=await pub('paykr_merchant_version');
 if(typeof version!=='string'||!/^\d+$/.test(version))throw Error('Invalid merchant version');
 const rows=await pub('paykr_search_merchants',{p_limit:1});
 if(!Array.isArray(rows)||rows.length>1)throw Error('Invalid public RPC response');
 let denied=false;
 try{await db('paykr_merchants?select=id&limit=1',{key:readKey});}catch(e){if(/^HTTP (401|403)$/.test(e.message))denied=true;else throw e;}
 if(!denied)throw Error('Public table direct SELECT still allowed');
 const invalid=await pub('paykr_search_merchants',{p_south:38,p_north:37,p_west:126,p_east:127,p_limit:1});
 if(!Array.isArray(invalid)||invalid.length)throw Error('Invalid bounds accepted');
 const state=await db('paykr_sync_state?select=id,value&id=in.(initial,quality_v5_plan,delta)');
 if(!Array.isArray(state))throw Error('Invalid sync state');
 const states=new Map(state.map(x=>[x.id,x.value]));
 const initial=states.get('initial'),plan=states.get('quality_v5_plan'),delta=states.get('delta');
 const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 const initialComplete=initial?.complete===true&&initial.region===17;
 const qualityComplete=Number.isInteger(plan?.end)&&plan.end>=0&&plan.end<=17&&plan?.replay?.complete===true&&plan.replay.region===plan.end;
 const deltaCaughtUp=typeof delta?.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(delta.day)&&delta.day===today&&delta.page===1;
 const bytes=Number(await operator('paykr_db_bytes'));
 if(!Number.isSafeInteger(bytes)||bytes<0)throw Error('Invalid DB size');
 const withinBudget=bytes<420*1024*1024;
 return {schema,version,publicRpc:true,directSelectDenied:denied,invalidBoundsRejected:true,hasRows:rows.length>0,initialComplete,qualityComplete,deltaCaughtUp,initialRegion:initial?.region??null,initialPage:initial?.page??null,replayEnd:plan?.end??null,replayRegion:plan?.replay?.region??null,deltaDay:delta?.day??null,dbMiB:Math.round(bytes/1048576*100)/100,withinBudget,technicalGate:initialComplete&&qualityComplete&&deltaCaughtUp&&rows.length>0&&withinBudget};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const report=await preflight();console.log(JSON.stringify(report,null,2));if(!report.technicalGate){console.log('NOT READY: collection/replay/delta or budget gate incomplete. No changes made.');if(process.argv.includes('--require-ready'))process.exitCode=1;}else console.log('Technical gate passed. Operator quality review, browser and actual payment policy checks still required.');}
 catch(e){console.error('Preflight failed:',e.message);process.exitCode=1;}
}

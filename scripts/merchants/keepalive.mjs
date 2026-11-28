import {createClients} from './client.mjs';
const {db,readKey}=createClients();if(!readKey)throw Error('Set SUPABASE_PUBLISHABLE_KEY');
const rows=await db('rpc/paykr_search_merchants',{key:readKey,method:'POST',body:{p_limit:1}});
if(!Array.isArray(rows)||rows.length>1)throw Error('Unexpected DB response');
console.log('Supabase RPC read succeeded; returned',rows.length,'row(s).');

import {createClients} from './client.mjs';
const {db,readKey}=createClients();if(!readKey)throw Error('Set SUPABASE_PUBLISHABLE_KEY');
const rows=await db('paykr_merchants?select=id&limit=1',{key:readKey});
if(!Array.isArray(rows)||rows.length>1)throw Error('Unexpected DB response');
console.log('Supabase table read succeeded; returned',rows.length,'row(s).');

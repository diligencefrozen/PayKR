import {readFile} from 'node:fs/promises';
import {createTurso} from './turso.mjs';
const mode=process.argv[2]??'check';
if(!['init','check'].includes(mode))throw new Error('Use init or check');
const sql=createTurso({url:process.env.TURSO_DATABASE_URL,token:process.env.TURSO_AUTH_TOKEN});
if(mode==='init'){
  const schema=await readFile(new URL('./schema.sql',import.meta.url),'utf8');
  for(const statement of schema.split(';').map(s=>s.trim()).filter(Boolean)) await sql(statement);
}
const version=await sql('SELECT value FROM community_meta WHERE key = ?', ['schema_version']);
if(version?.rows?.[0]?.[0]?.value!=='1')throw new Error('Community schema missing or incompatible');
const tables=await sql("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('community_meta','payment_reports','comments','merchant_reports') ORDER BY name");
if(tables?.rows?.length!==4)throw new Error('Community tables missing');
console.log('Turso community schema 1: connected; 4 tables verified.');

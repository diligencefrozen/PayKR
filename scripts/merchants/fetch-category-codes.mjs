// Official guide: smallUpjongList, optional parent codes, no page parameters.
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {publicUrl,request} from './client.mjs';
export function parseCategoryCodes(payload){
 const r=payload?.response||payload;
 if(String(r?.header?.resultCode)!=='00')throw Error('Category endpoint application error');
 const raw=r.body?.items?.item??r.body?.items;
 const rows=Array.isArray(raw)?raw:raw&&typeof raw==='object'?[raw]:[];
 if(!rows.length)throw Error('Empty category dictionary');
 const out={};
 for(const row of rows){const code=String(row.indsSclsCd??''),label=String(row.indsSclsNm??'').trim();if(!/^[A-Za-z0-9]{6}$/.test(code)||!label||label.length>100)throw Error('Invalid source category');if(out[code]&&out[code]!==label)throw Error('Conflicting labels for '+code);out[code]=label;}
 return Object.fromEntries(Object.entries(out).sort());
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const key=process.env.PUBLIC_DATA_API_KEY;if(!key)throw Error('Set PUBLIC_DATA_API_KEY in environment');
 const response=await request(publicUrl('smallUpjongList',{},key));
 const codes=parseCategoryCodes(await response.json());
 const path=process.argv[2]||'category-codes-candidate.json';await writeFile(path,JSON.stringify(codes,null,2)+'\n',{flag:'wx'});console.log('Official endpoint returned',Object.keys(codes).length,'codes; review completeness before use.');
}

import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {qualityMatcher,duplicateCandidates,QUALITY_VERSION} from '../../src/models/merchant-quality.js';
// RFC4180 quoted fields, embedded commas/newlines and BOM.
export function parseCsv(input){
 const text=input.replace(/^\uFEFF/,'');const records=[];let record=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;}
 else if(c==='"'&&!field)quoted=true;else if(c===','){record.push(field);field='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;record.push(field);records.push(record);record=[];field='';}else field+=c;}
 if(quoted)throw Error('Unclosed CSV quote');if(field||record.length){record.push(field);records.push(record);}const header=records.shift();if(!header||!['id','brand_id','name','address','category'].every(k=>header.includes(k)))throw Error('Invalid merchant CSV');
 return records.filter(r=>r.some(Boolean)).map(r=>{if(r.length!==header.length)throw Error('CSV column mismatch');return Object.fromEntries(header.map((k,i)=>[k,r[i]]));});
}
export function audit(rows,brands){
 const q=qualityMatcher(brands),counts={},reasons={},review=[],ids=new Set();let duplicateIds=0,accepted=0;
 for(const r of rows){if(ids.has(r.id))duplicateIds++;ids.add(r.id);counts[r.brand_id]=(counts[r.brand_id]||0)+1;
  const a=q.assess(r.name,r.category);const reason=a.status==='accepted'?(a.brand.id===r.brand_id?null:'brand_changed'):a.reason;
  if(!reason){accepted++;continue;}reasons[reason]=(reasons[reason]||0)+1;review.push({id:r.id,brand_id:r.brand_id,name:r.name,address:r.address,category:r.category,reason,suggested_brand:a.brand?.id??null});}
 const duplicates=duplicateCandidates(rows);
 return {summary:{qualityVersion:QUALITY_VERSION,total:rows.length,accepted,review:review.length,duplicateIds,duplicateGroups:duplicates.length,nearbyDuplicateGroups:duplicates.filter(g=>g.nearby).length,coveredBrands:Object.keys(counts).length,catalogBrands:brands.length,reasons},brands:brands.map(b=>({id:b.id,name:b.names.ko,count:counts[b.id]||0})),review,duplicates};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [, , input,output='merchant-audit.json']=process.argv;if(!input)throw Error('Usage: node scripts/merchants/audit.mjs input.csv [output.json]');
 const brands=JSON.parse(await readFile(new URL('../../src/data/stores.json',import.meta.url)));const result=audit(parseCsv(await readFile(input,'utf8')),brands);await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result.summary,null,2));
}

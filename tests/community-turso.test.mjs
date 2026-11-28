import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurso} from '../scripts/community/turso.mjs';
const url='libsql://example.turso.io';
const token='mock-secret';
test('HTTPS pipeline, auth, bound values, connection close',async()=>{
  const sql=createTurso({url,token,fetcher:async (u,opt)=>{
    assert.equal(u,'https://example.turso.io/v2/pipeline');
    assert.equal(opt.headers.Authorization,'Bearer mock-secret');
    assert.equal(opt.redirect,'manual');
    const payload=JSON.parse(opt.body);
    assert.deepEqual(payload.requests,[{type:'execute',stmt:{sql:'SELECT ?',args:[{type:'text',value:'test'}]}},{type:'close'}]);
    return {ok:true,json:async()=>({results:[{type:'ok',response:{type:'execute',result:{rows:[]}}},{type:'ok',response:{type:'close'}}]})};
  }});
  assert.deepEqual(await sql('SELECT ?',['test']),{rows:[]});
});
test('reject non-Turso endpoint and missing secret',()=>{
  assert.throws(()=>createTurso({url:'https://example.com',token}));
  assert.throws(()=>createTurso({url,token:''}));
});
test('reject SQL error even when HTTP is successful',async()=>{
  const sql=createTurso({url,token,fetcher:async()=>({ok:true,json:async()=>({results:[{type:'error',error:{message:'secret'}}]})})});
  await assert.rejects(sql('SELECT 1'),{message:'Turso SQL execution failed'});
});

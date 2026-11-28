"""Real Chromium/IndexedDB; Kakao and Supabase network mocked, no keys or live calls.
Run: python tests/merchant-browser.py (Python playwright + Chromium installed).
"""
import json, os, re, shutil, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
fixture=(ROOT/'tests/browser-ui.mjs').read_text().split('await withBrowser(async',1)[0].split('function kakaoFixture()',1)[1]
fixture='(function kakaoFixture()'+fixture.strip()+')()'
server=subprocess.Popen(['node','scripts/preview.mjs','0'],cwd=ROOT,stdout=subprocess.PIPE,text=True)
base=server.stdout.readline().strip()
assert base.startswith('http://127.0.0.1:'),base
try:
 with sync_playwright() as p:
  chromium=os.environ.get('PAYKR_CHROME') or shutil.which('chromium') or shutil.which('google-chrome')
  browser=p.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox'])
  for denied in (False,True):
   c=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
   c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
   c.add_init_script(fixture)
   page=c.new_page();page.goto(base+'index.ko.html');page.wait_for_function('fixture.gps.length===1')
   assert page.evaluate('fixture.calls.length')==0,'no premature fallback search'
   if denied:
    page.evaluate('fixture.gps[0].fail({code:1})');lat=37.34487430629196
   else:
    page.evaluate('fixture.gps[0].ok({coords:{latitude:37.5665,longitude:126.978}})');lat=37.5665
   names=page.evaluate("async()=> (await (await fetch('./src/data/stores.json')).json()).map(b=>b.names.ko)")
   page.wait_for_function('names=>names.every(n=>fixture.calls.some(c=>c.keyword===n&&c.page===2))',arg=names,timeout=20000)
   assert abs(page.evaluate('fixture.map.center.lat')-lat)<1e-8
   page.evaluate('fixture.map.setLevel(6);fixture.calls.length=0')
   page.locator('#mobile-categories [data-category="all"]').click()
   page.wait_for_function('names=>names.every(n=>fixture.calls.some(c=>c.keyword===n&&c.page===2))',arg=names,timeout=20000)
   assert page.evaluate('fixture.map.level')==6 and abs(page.evaluate('fixture.map.center.lat')-lat)<1e-8
   c.close();print('PASS: real browser GPS '+('denial/fallback' if denied else 'success')+', 165-brand sweep, All preserves viewport',flush=True)
  c=browser.new_context(service_workers='block');c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
  first=c.new_page();second=c.new_page()
  for page in (first,second): page.goto(base+'guide.html')
  setup="""async()=>{const {MerchantStore}=await import('./src/infrastructure/cache/merchant-store.js');const {MerchantCache}=await import('./src/infrastructure/cache/merchant-cache.js');window.s=new MerchantStore(indexedDB,'v06-browser');window.c=new MerchantCache(s);window.calls=0;window.load=async()=>{calls++;return [{id:'fixture',brand_id:'store-8',name:'Test',lat:37.5,lng:127}]};}"""
  for page in (first,second):page.evaluate(setup)
  first.evaluate("async()=>{await c.clear();await c.get('public',load,{persist:true});await c.get('public',load,{persist:true});}")
  assert first.evaluate('c.snapshot().l1')==1 and first.evaluate('calls')==1
  second.evaluate("()=>c.get('public',load,{persist:true})")
  assert second.evaluate('c.snapshot().l2')==1 and second.evaluate('calls')==0
  first.evaluate("()=>c.get('private-gps',load,{persist:false})")
  assert second.evaluate("async()=>!(await s.readSnapshot('private-gps')).record")
  first.evaluate("async()=>{window.old=await s.readSnapshot('public');await c.clear();await s.write('public',old.record,old.epoch);}")
  assert second.evaluate("async()=>!(await s.readSnapshot('public')).record")
  print('PASS: real IndexedDB persistence across tabs, L1/L2 hits, private GPS exclusion, stale writer rejection',flush=True)
  # Actual MerchantSearch in Chromium with fake fetcher: no live external calls.
  result=first.evaluate("""async()=>{
   const {MerchantSearch}=await import('./src/services/merchant-search.js');const {MerchantCache}=await import('./src/infrastructure/cache/merchant-cache.js');
   const all=await (await fetch('./src/data/stores.json')).json();let version='1',calls=0,fail=false;
   const rows=[{id:'1',brand_id:'store-8',name:'Test A',lat:37.501,lng:127.001},{id:'2',brand_id:'store-1',name:'Test B',lat:37.5015,lng:127.0015}];
   const fetcher=async(url,opts)=>{if(url.endsWith('paykr_merchant_version'))return new Response(JSON.stringify(version));calls++;if(fail)throw Error('offline');return new Response(JSON.stringify(rows));};
   const catalog={query:async(_,category)=>category==='all'||!category?all:all.filter(b=>b.categories.includes(category))};
   const search=new MerchantSearch({url:'https://fixture.invalid',publishableKey:'sb_publishable_fixture'},catalog,{search:()=>{throw Error('unexpected Kakao call')}},[],fetcher,new MerchantCache(s));
   const bounds=[37.5001,127.0001,37.503,127.003];const a=await search.search({bounds});const firstCalls=calls;
   const b=await search.search({bounds});const repeated=calls;
   version='2';search.version.checked=-Infinity;fail=true;const stale=await search.search({bounds});
   return {a:a.items.length,b:b.items.length,firstCalls,repeated,stale:stale.stale};
  }""")
  assert result['a']==2 and result['b']==2 and result['firstCalls']==result['repeated'] and result['stale'],result
  print('PASS: MerchantSearch browser spatial cache and previous-version outage recovery (mock RPC)',flush=True)
  c.close();browser.close()
finally:
 server.terminate();server.wait(timeout=5)

// Server-side only. Never import into the browser bundle.
export function createTurso({url,token,fetcher=fetch}) {
  if (!url || !token) throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  const endpoint = new URL(url.replace(/^libsql:\/\//,'https://').replace(/^turso:\/\//,'https://'));
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.turso.io') || endpoint.username || endpoint.password || endpoint.port || endpoint.search || endpoint.hash || endpoint.pathname !== '/') throw new Error('Invalid Turso database URL');
  endpoint.pathname='/v2/pipeline';
  return async (sql,args=[])=>{
    const response=await fetcher(endpoint.href,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({requests:[{type:'execute',stmt:{sql,args:args.map(value=>({type:'text',value:String(value)}))}},{type:'close'}]})});
    if(!response.ok)throw new Error(`Turso HTTP ${response.status}`);
    const result=await response.json();
    const [run,close]=result?.results??[];
    if(run?.type!=='ok'||run.response?.type!=='execute'||close?.type!=='ok'||close.response?.type!=='close') throw new Error('Turso SQL execution failed');
    return run.response.result;
  };
}

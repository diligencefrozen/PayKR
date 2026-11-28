import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const input=process.argv[2];let url='';
if(input!=='--disable'){
  if(!input)throw Error('Usage: node scripts/community/configure.mjs https://paykr-community.<subdomain>.workers.dev OR --disable');
  const u=new URL(input);if(u.protocol!=='https:'||!u.hostname.endsWith('.workers.dev')||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash)throw Error('Expected HTTPS Worker origin');url=u.origin;
}
await writeFile(new URL('../../src/config/community.js',import.meta.url),'// Public API origin only; never put DB secrets here.\nexport const communityConfig = Object.freeze({apiBase: '+JSON.stringify(url)+'});\n');
const r=spawnSync(process.execPath,[fileURLToPath(new URL('../pwa-assets.mjs',import.meta.url))],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);

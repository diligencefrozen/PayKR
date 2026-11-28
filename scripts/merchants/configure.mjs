import {writeFile} from 'node:fs/promises';
const enabled=process.argv.includes('--enable');
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'';
if(enabled&&(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key.startsWith('sb_publishable_')))throw Error('Only public Supabase URL and sb_publishable_ key accepted');
await writeFile(new URL('../../src/config/merchants.js',import.meta.url),'// Generated public configuration. Never put secret keys here.\nexport const merchants = Object.freeze('+JSON.stringify({enabled,url:enabled?url:'',publishableKey:enabled?key:''})+');\n');
console.log(enabled?'DB search enabled in public config':'Legacy search restored');

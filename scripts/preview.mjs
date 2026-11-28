import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};
const entries =
  /^(?:(?:index|guide|online)(?:\.(?:[a-z]{2}|zh-Hans|zh-Hant))?\.html|(?:offline|terms)\.html|(?:theme|place-text|sw|pwa-assets)\.js|(?:shared|main|online|extensions)\.css|favicon\.svg|manifest\.webmanifest|sitemap\.xml|structured-data\.json|robots\.txt|forum\/index\.html|docs\/release-history\.txt)$/;
const assets = /^(?:src|icons|assets|logo|logo_online|vendor\/koroman)\/[\w./-]+\.(?:js|json|css|svg|png)$/;

export async function serve(port = 0, directory = root) {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (path === '/') {
        res.writeHead(302, { Location: '/PayKR/' });
        res.end();
        return;
      }
      if (!path.startsWith('/PayKR/') || path.includes('..')) throw Error();
      let file = path.slice(7);
      if (!file || file.endsWith('/')) file += 'index.html';
      const baselineScript = directory !== root && ['main.js', 'i18n.js', 'online.js'].includes(file);
      if (!entries.test(file) && !assets.test(file) && !baselineScript) throw Error();
      const absolute = resolve(directory, file);
      if (!absolute.startsWith(resolve(directory) + sep)) throw Error();
      const bytes = await readFile(absolute);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', ok);
  });
  return {
    base: 'http://127.0.0.1:' + server.address().port + '/PayKR/',
    close: async () => {
      server.closeAllConnections();
      await new Promise((ok) => server.close(ok));
    },
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { base } = await serve(Number(process.argv[2] || 8766));
  console.log(base);
}

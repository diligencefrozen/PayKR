import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const jobs = [
  ['scripts/pages.mjs', '--check'],
  ['scripts/pwa-assets.mjs', '--check'],
  ...['map-ui', 'directory', 'cache', 'ads', 'locale', 'project', 'seo', 'pwa', 'merchants', 'sync-mock', 'merchant-cache', 'spatial-cache', 'merchant-quality', 'preflight'].map((name) => [
    'tests/' + name + '.test.mjs',
  ]),
];
if (process.argv.includes('--browser')) {
  jobs.push(
    ['tests/browser-ui.mjs', ...process.argv.slice(2).filter((v) => v === '--screenshots')],
    ['tests/storage-browser.mjs'],
    ['tests/pwa.test.mjs', '--browser'],
  );
}
for (const args of jobs) {
  const run = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (run.error) throw run.error;
  if (run.status !== 0) process.exit(run.status || 1);
}

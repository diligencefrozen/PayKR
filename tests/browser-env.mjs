import { createRequire } from 'node:module';
import { serve } from '../scripts/preview.mjs';

export async function withBrowser(run, fixtureRoot) {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PAYKR_PLAYWRIGHT || 'playwright');
  const server = await serve(0, fixtureRoot);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.PAYKR_CHROME, headless: true });
    await run(browser, server.base);
  } finally {
    await browser?.close();
    await server.close();
  }
}

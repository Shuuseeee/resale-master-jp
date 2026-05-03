// Debug script: dump rendered HTML from KaitoriX product page
import 'dotenv/config';
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { buildProductUrl } from './config.js';

const jan = process.argv[2] || '4547410529845';
const url = buildProductUrl(jan);

(async () => {
  const context = await chromium.launchPersistentContext('./browser-data', {
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: 'ja-JP',
  });

  const page = await context.newPage();
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for SPA rendering
  await page.waitForTimeout(10000);

  const html = await page.content();
  writeFileSync('debug-page.html', html, 'utf-8');
  console.log(`Saved to debug-page.html (${html.length} bytes)`);

  // Also log text content summary
  const bodyText = await page.$eval('body', el => el.innerText);
  console.log('\n--- Page text content ---\n');
  console.log(bodyText.slice(0, 3000));

  await context.close();
})();

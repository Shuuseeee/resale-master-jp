import { type Browser, type BrowserContext, chromium } from 'playwright';
import { CONFIG } from './config.js';
import { log, logError } from './logger.js';

interface ScrapedPrice {
  store: string;
  price: number;
  url: string;
  updated: string;
}

export interface ScrapeResult {
  product_name: string;
  prices: ScrapedPrice[];
  max_price: number;
  max_store: string;
}

let browser: Browser | null = null;
let context: BrowserContext | null = null;

export async function launchBrowser() {
  if (browser) return;
  log('Launching Chromium...');
  browser = await chromium.launchPersistentContext(CONFIG.USER_DATA_DIR, {
    headless: CONFIG.HEADLESS,
    viewport: { width: 1280, height: 900 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  }).then(ctx => {
    context = ctx;
    return ctx.browser()!;
  });
  log('Browser ready');
}

export async function closeBrowser() {
  if (context) {
    await context.close().catch(() => {});
    context = null;
    browser = null;
    log('Browser closed');
  }
}

export async function scrapeProduct(jan: string): Promise<ScrapeResult | null> {
  if (!context) throw new Error('Browser not launched');

  const page = await context.newPage();
  try {
    const url = `${CONFIG.BASE_URL}/${jan}`;
    log(`Navigating to ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.PAGE_TIMEOUT });

    // Wait for price list to render
    const found = await page.waitForSelector('.prices-list .price-row', { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!found) {
      log(`Product not found for JAN: ${jan}`);
      return null;
    }

    // Extract product name
    const productName = await page.$eval(
      '#productName, .product-name, .product-top-row h2',
      el => el.textContent?.trim() || ''
    ).catch(() => '');

    // Extract prices from .price-row elements
    const prices: ScrapedPrice[] = await page.$$eval('.prices-list .price-row', (rows) => {
      return rows.map(row => {
        const nameEl = row.querySelector('.store-name a') || row.querySelector('.store-name');
        const priceEl = row.querySelector('.price-value');
        const updatedEl = row.querySelector('.price-updated');

        const store = nameEl?.textContent?.trim() || '';
        const priceText = priceEl?.textContent?.trim() || '';
        const priceNum = parseInt(priceText.replace(/[^0-9]/g, ''), 10);

        const linkEl = row.querySelector('.store-name a');
        const url = linkEl?.getAttribute('href') || '';

        const updated = updatedEl?.textContent?.trim() || '';

        if (!store || isNaN(priceNum)) return null;

        return { store, price: priceNum, url, updated };
      }).filter(Boolean) as { store: string; price: number; url: string; updated: string }[];
    });

    if (prices.length === 0) {
      log(`No prices found in DOM for JAN: ${jan}`);
      return null;
    }

    const best = prices.reduce((max, p) => p.price > max.price ? p : max, prices[0]);

    const result: ScrapeResult = {
      product_name: productName,
      prices,
      max_price: best.price,
      max_store: best.store,
    };

    log(`Scraped ${jan}: ${prices.length} stores, max ¥${best.price} @ ${best.store}`);
    return result;
  } catch (err) {
    logError(`Scrape failed for ${jan}`, err);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

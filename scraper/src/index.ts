import { supabase } from './supabase.js';
import { CONFIG, jitter } from './config.js';
import { launchBrowser, closeBrowser, scrapeProduct } from './scraper.js';
import { log, logError } from './logger.js';

let running = true;
let loopCount = 0;
const CLEANUP_EVERY = 100; // cleanup completed/failed queue rows every 100 loops

async function pollQueue() {
  // Atomically dequeue one pending item (FOR UPDATE SKIP LOCKED prevents race conditions)
  const { data: items, error } = await supabase.rpc('dequeue_kaitorix_scrape');

  if (error) {
    logError('Failed to poll queue', error);
    return false;
  }

  if (!items || items.length === 0) return false;

  const item = items[0];
  log(`Processing queue item: JAN=${item.jan} (attempt ${item.attempts}/${CONFIG.MAX_ATTEMPTS})`);

  const result = await scrapeProduct(item.jan);

  if (result && result.max_price > 0) {
    // Upsert into cache (only if max_price is valid)
    const { error: upsertErr } = await supabase
      .from('kaitorix_price_cache')
      .upsert({
        jan: item.jan,
        product_name: result.product_name,
        max_price: result.max_price,
        max_store: result.max_store,
        prices: result.prices,
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'jan' });

    if (upsertErr) {
      logError('Failed to upsert cache', upsertErr);
    }

    // Mark completed
    await supabase
      .from('kaitorix_scrape_queue')
      .update({ status: 'completed' })
      .eq('id', item.id);

    log(`Completed: JAN=${item.jan}`);
  } else {
    // Failed (attempts already incremented by dequeue_kaitorix_scrape)
    const newStatus = item.attempts >= CONFIG.MAX_ATTEMPTS ? 'failed' : 'pending';
    await supabase
      .from('kaitorix_scrape_queue')
      .update({
        status: newStatus,
        error_message: 'Scrape returned no data',
      })
      .eq('id', item.id);

    log(`Failed: JAN=${item.jan}, status → ${newStatus}`);
  }

  return true;
}

async function mainLoop() {
  log('Scraper started, polling queue...');
  await launchBrowser();

  while (running) {
    try {
      loopCount++;
      if (loopCount % CLEANUP_EVERY === 0) {
        const { data: cleaned } = await supabase.rpc('cleanup_kaitorix_queue');
        if (cleaned > 0) log(`Cleaned up ${cleaned} old queue records`);
      }

      const hadWork = await pollQueue();
      const delay = jitter(hadWork ? CONFIG.POLL_INTERVAL_BUSY : CONFIG.POLL_INTERVAL_IDLE);
      if (!hadWork) log('Queue empty, waiting...');

      // Interruptible sleep
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, delay);
        if (!running) { clearTimeout(timer); resolve(); }
      });

      // Add scrape delay between items
      if (hadWork && running) {
        await new Promise(resolve => setTimeout(resolve, jitter(CONFIG.SCRAPE_DELAY)));
      }
    } catch (err) {
      logError('Main loop error', err);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Graceful shutdown
function shutdown() {
  log('Shutting down...');
  running = false;
  closeBrowser().then(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

mainLoop().catch(err => {
  logError('Fatal error', err);
  closeBrowser().then(() => process.exit(1));
});

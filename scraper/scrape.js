/**
 * IoW Festival Ticket Price Scraper
 * Scrapes Twickets for adult camping resale listings and appends
 * a new snapshot to data/snapshots.json.
 *
 * Usage:
 *   node scrape.js           — full scrape, writes data
 *   node scrape.js --dry-run — scrape only, prints JSON, no file write
 *   node scrape.js --year 2027 — target a specific year's config
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const EVENTS_FILE = path.join(ROOT, 'data', 'events.json');
const SNAPS_FILE  = path.join(ROOT, 'data', 'snapshots.json');
// public/data/ mirrors data/ so Netlify serves the latest snapshots
const PUBLIC_SNAPS_FILE = path.join(ROOT, 'public', 'data', 'snapshots.json');

const isDryRun = process.argv.includes('--dry-run');
const yearArg  = process.argv.indexOf('--year');
const targetYear = yearArg !== -1 ? process.argv[yearArg + 1] : null;

// ── HELPERS ────────────────────────────────────────────────────────────────

function daysBetween(d1, d2) {
  return Math.ceil((new Date(d2) - new Date(d1)) / 86400000);
}

function isoDate() {
  return new Date().toISOString().split('T')[0];
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// Keyword filter — identifies adult camping tickets, excludes non-camping, glamping, car parks, etc.
const CAMPING_KEYWORDS   = ['camping', 'camp'];
const ADULT_KEYWORDS     = ['adult', 'weekend adult', 'adult weekend'];
const EXCLUDE_KEYWORDS   = ['child', 'parking', 'car park', 'glamping', 'lodge', 't-shirt',
                            'lanyard', 'programme', 'ferry', 'coach', 'bus', 'harvest moon',
                            'lakeside', 'lodge'];

function isAdultCamping(tier) {
  const t = tier.toLowerCase();
  const hasCamping = CAMPING_KEYWORDS.some(k => t.includes(k));
  const isExcluded = EXCLUDE_KEYWORDS.some(k => t.includes(k));
  return hasCamping && !isExcluded;
}

// ── SCRAPER ────────────────────────────────────────────────────────────────

async function scrape(eventConfig) {
  const { twicketsUrl, festival } = eventConfig;

  if (!twicketsUrl) {
    throw new Error('No twicketsUrl configured for this year. Update events.json when tickets go on sale.');
  }

  log(`Launching browser...`);
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-GB',
  });

  // Dismiss cookie banner automatically
  context.on('page', async page => {
    page.on('dialog', async dialog => { await dialog.dismiss(); });
  });

  const page = await context.newPage();

  try {
    log(`Navigating to ${twicketsUrl}`);
    await page.goto(twicketsUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Dismiss cookie consent if present
    try {
      await page.click('button:has-text("Allow all")', { timeout: 5000 });
      await page.waitForTimeout(1000);
      log('Cookie banner dismissed');
    } catch {
      log('No cookie banner found (or already dismissed)');
    }

    // Wait for listings to load
    await page.waitForSelector('#list > li', { timeout: 15000 });
    log('Listings loaded');

    // Click "Load more" until all listings are visible
    let loadMoreClicks = 0;
    while (true) {
      const loadMoreBtn = page.locator('button:has-text("Load more")');
      const isVisible = await loadMoreBtn.isVisible().catch(() => false);
      if (!isVisible) break;
      await loadMoreBtn.click();
      await page.waitForTimeout(2000);
      loadMoreClicks++;
      log(`Loaded more... (${loadMoreClicks} clicks)`);
      if (loadMoreClicks > 20) { log('Safety limit reached on Load More'); break; } // safety cap
    }

    // Extract listings
    const listings = await page.evaluate(() => {
      const items = document.querySelectorAll('#list > li');
      const results = [];
      items.forEach(li => {
        const summaryEl       = li.querySelector('.inline-block.no-of-ticket-summary');
        const priceDeclaration = li.querySelector('.price-declaration');
        const tierEl          = li.querySelector('.tier-name');
        const offersEl        = li.querySelector('.make-offer-available');

        const summaryText = summaryEl ? summaryEl.innerText.trim() : '';
        const tierText    = tierEl    ? tierEl.innerText.replace(/\n/g, ' | ').trim() : '';
        const priceDecl   = priceDeclaration ? priceDeclaration.innerText.trim() : '';
        const hasOffers   = offersEl ? !offersEl.hidden : false;

        const qtyMatch   = summaryText.match(/^(\d+)\s+ticket/);
        const priceMatch = summaryText.match(/£([\d,]+(?:\.\d+)?)/);

        if (!priceMatch) return;

        results.push({
          qty:    qtyMatch ? parseInt(qtyMatch[1]) : 1,
          price:  parseFloat(priceMatch[1].replace(',', '')),
          tier:   tierText,
          pctDeclaration: priceDecl,
          offers: hasOffers,
        });
      });
      return results;
    });

    log(`Extracted ${listings.length} total listings from page`);

    // Filter to adult camping only
    const campingListings = listings.filter(l => isAdultCamping(l.tier));
    log(`Filtered to ${campingListings.length} adult camping listings (${listings.length - campingListings.length} excluded as non-camping/glamping/other)`);

    await browser.close();
    return campingListings;

  } catch (err) {
    // Save a screenshot so we can see what Twickets showed on failure
    try {
      const screenshotPath = path.join(__dirname, '..', 'failure-screenshot.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      log(`Failure screenshot saved to ${screenshotPath}`);
    } catch (ssErr) {
      log(`Could not save screenshot: ${ssErr.message}`);
    }
    await browser.close();
    throw err;
  }
}

// ── STATS ──────────────────────────────────────────────────────────────────

function computeSummary(listings) {
  if (!listings.length) return {};
  const prices = listings.map(l => l.price).sort((a, b) => a - b);
  const sum    = prices.reduce((s, p) => s + p, 0);
  const n      = prices.length;
  const median = n % 2 === 0
    ? (prices[n/2 - 1] + prices[n/2]) / 2
    : prices[Math.floor(n/2)];
  return {
    count:  n,
    min:    prices[0],
    max:    prices[n - 1],
    avg:    Math.round((sum / n) * 100) / 100,
    median: Math.round(median * 100) / 100,
  };
}

// ── DISAPPEARANCE INFERENCE ────────────────────────────────────────────────

function fingerprint(l) {
  return `${l.price}|${l.qty}|${l.tier}`;
}

function inferSold(prevSnap, currSnap) {
  if (!prevSnap) return [];
  const prevFps  = prevSnap.listings.map(fingerprint);
  const currFps  = new Set(currSnap.listings.map(fingerprint));
  const fpCounts = {};
  prevFps.forEach(fp => fpCounts[fp] = (fpCounts[fp] || 0) + 1);

  const sold = [];
  const seen = {};
  prevSnap.listings.forEach(l => {
    const fp = fingerprint(l);
    seen[fp] = (seen[fp] || 0) + 1;
    if (!currFps.has(fp) && seen[fp] === 1) {
      sold.push({
        appearedDate:     prevSnap.date,
        disappearedDate:  currSnap.date,
        daysListed:       daysBetween(prevSnap.date, currSnap.date),
        price:            l.price,
        qty:              l.qty,
        tier:             l.tier,
        offersAccepted:   l.offers,
        confidence:       fpCounts[fp] === 1 ? 'high' : 'low',
        note: l.offers
          ? 'Accepting Offers — actual sold price may be lower than listed'
          : null,
      });
    }
  });
  return sold;
}

// ── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  // Load config
  const events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  const snapsData = JSON.parse(fs.readFileSync(SNAPS_FILE, 'utf8'));

  // Determine which year to scrape
  const currentYear  = new Date().getFullYear().toString();
  const year         = targetYear || currentYear;
  const eventConfig  = events.years[year];

  if (!eventConfig) {
    throw new Error(`No config found for year ${year}. Add it to data/events.json.`);
  }

  const today       = isoDate();
  const daysToFest  = daysBetween(today, eventConfig.festival.date);

  // Don't scrape if festival is in the past or more than 2 years away
  if (daysToFest < -7) {
    log(`Festival ${year} is in the past (${daysToFest}d ago). Nothing to scrape.`);
    process.exit(0);
  }
  if (daysToFest > 730) {
    log(`Festival ${year} is ${daysToFest} days away — too far to track yet.`);
    process.exit(0);
  }

  // Skip if we already have a snapshot within the last 12 minutes
  // (prevents accidental double-runs while allowing the 15-min cron schedule through)
  const RECENT_WINDOW_MS = 12 * 60 * 1000;
  const recentSnap = snapsData.snapshots.find(s => {
    if (s.year !== year) return false;
    const snapTime = new Date(s.timestamp).getTime();
    return (Date.now() - snapTime) < RECENT_WINDOW_MS;
  });
  if (recentSnap && !isDryRun) {
    log(`Already have a snapshot within the last 12 min (${recentSnap.timestamp}). Skipping.`);
    process.exit(0);
  }

  log(`Scraping year ${year}, ${daysToFest} days to festival...`);

  // Retry up to 3 times — Twickets occasionally times out or returns a slow page
  let listings;
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      listings = await scrape(eventConfig);
      break; // success — exit retry loop
    } catch (err) {
      log(`Scrape attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
      if (attempt === MAX_ATTEMPTS) {
        log('All attempts exhausted — exiting with failure.');
        process.exit(1);
      }
      const waitSec = attempt * 15;
      log(`Waiting ${waitSec}s before retry...`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
    }
  }

  // Build snapshot — write even when listings is empty so we have a complete record.
  // An empty snapshot tells us the market was dry at this hour, which is useful data.
  if (!listings.length) {
    log('No adult camping listings found — market may be empty or page structure may have changed.');
  }

  const prevSnap   = snapsData.snapshots
    .filter(s => s.year === year)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] || null;

  const newSnap = {
    year,
    date:          today,
    timestamp:     new Date().toISOString(),
    daysToFestival: daysToFest,
    source:        'automated',
    listings,
    summary:       computeSummary(listings),
    inferredSold:  inferSold(prevSnap, { date: today, listings }),
    ...(listings.length === 0 && { marketEmpty: true }),
  };

  if (newSnap.summary.count) {
    log(`Summary: ${newSnap.summary.count} listings, min £${newSnap.summary.min}, avg £${newSnap.summary.avg}, max £${newSnap.summary.max}`);
  } else {
    log('Summary: 0 adult camping listings (market empty snapshot written)');
  }
  if (newSnap.inferredSold.length) {
    log(`Inferred ${newSnap.inferredSold.length} likely sold since last snapshot:`);
    newSnap.inferredSold.forEach(s => log(`  • £${s.price} x${s.qty} (${s.tier}) — confidence: ${s.confidence}`));
  }

  if (isDryRun) {
    log('DRY RUN — not writing to file');
    console.log(JSON.stringify(newSnap, null, 2));
    process.exit(0);
  }

  // Append to snapshots file (write to both data/ and public/data/ so Netlify serves latest)
  snapsData.meta.lastUpdated = today;
  snapsData.snapshots.push(newSnap);
  const snapsJson = JSON.stringify(snapsData, null, 2);
  fs.writeFileSync(SNAPS_FILE, snapsJson, 'utf8');
  fs.writeFileSync(PUBLIC_SNAPS_FILE, snapsJson, 'utf8');
  log(`✅ Snapshot written to ${SNAPS_FILE} and ${PUBLIC_SNAPS_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

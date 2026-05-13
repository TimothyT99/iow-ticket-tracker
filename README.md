# IoW Festival Ticket Price Tracker

Tracks resale prices for Isle of Wight Festival adult weekend camping tickets on Twickets.
Scrapes every 15 minutes via cron-job.org → GitHub Actions, stores data in JSON,
and serves a live dashboard via Netlify.

**What it does:**
- 📊 Tracks all-in prices over time (listed price + ~15.9% Twickets buyer fee)
- 💸 Infers likely sold prices from listing disappearances
- 🎯 Generates buy/sell timing signals vs Ticketmaster current price
- 📣 Marks lineup announcement dates on charts
- 🗂 Multi-year — works for 2026, 2027, and beyond

---

## Pricing model

All prices shown on the dashboard are **all-in estimates** — the listed asking price plus the
Twickets buyer fee (~15.9% on the transaction price, added at checkout). This makes resale prices
directly comparable to face value purchases where fees are typically bundled.

Reference baselines (stored in `data/events.json` → `baselines`):

| Baseline | Price | Notes |
|---|---|---|
| Ticketmaster now | £320 | Standard adult camping, on sale May 2026 |
| Owner early bird | £231.35 | Sky early bird, purchased Jun 2025, fees bundled |
| Greg's resale | £243.45 | Twickets resale Apr 2026, offer £210 + fee £33.45 |

---

## Scrape schedule

Twickets IoW listings are active between **07:30–21:00 UK time** with zero overnight activity.
At peak season, listings sell within minutes of posting.

| Period | Primary trigger | Fallback | Runs/day |
|---|---|---|---|
| Peak season (Mar–Jun) | cron-job.org every 15 min, 07:00–23:00 BST | GitHub Actions hourly 07:00–21:00 UTC | ~64 |
| Off-season (Jan–Feb, Jul–Dec) | — | GitHub Actions once daily 08:00 UTC | 1 |

**Why cron-job.org?** GitHub's own scheduler throttles `*/15` cron jobs on public repos to
roughly hourly. cron-job.org triggers the workflow via `workflow_dispatch` on a reliable
15-minute schedule. GitHub Actions serves as a fallback if cron-job.org goes down.

**Why keep the repo public?** At 15-min frequency (~2 min/run × 64 runs/day), a private repo
would exhaust the free 2,000 min/month budget in ~15 days. Public repos have unlimited minutes.

The scraper deduplicates within a 12-minute window to prevent double-runs. On transient
Twickets failures it retries up to 3 times (15s, 30s waits). On failure, a screenshot is
uploaded as a GitHub Actions artifact for debugging.

---

## Setup (one-time, ~25 minutes)

### 1. Move to your Development folder

```bash
cp -r ~/Documents/IoW/iow-ticket-tracker ~/Development/iow-ticket-tracker
cd ~/Development/iow-ticket-tracker
```

### 2. Create the GitHub repo

```bash
git init
git add .
git commit -m "Initial commit"
```

Then on GitHub: **New repository** → name it `iow-ticket-tracker` → **Public** → don't initialise with README.

```bash
git remote add origin https://github.com/YOUR_USERNAME/iow-ticket-tracker.git
git branch -M main
git push -u origin main
```

### 3. Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connect to GitHub, select `iow-ticket-tracker`
3. Build settings:
   - **Build command:** *(leave blank)*
   - **Publish directory:** `public`
4. Deploy — your dashboard is live

### 4. Set up cron-job.org (15-min reliable scraping)

**4a. Create a GitHub Personal Access Token**
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic) — name it `iow-cron-trigger`
3. Expiry: 90 days (covers the festival season)
4. Scope: tick **`workflow`** only
5. Copy the token (shown once only)

**4b. Create the cron-job.org job**
1. Log in at [console.cron-job.org](https://console.cron-job.org) → **Create cronjob**
2. **Title:** `IoW ticket scraper`
3. **URL:** `https://api.github.com/repos/YOUR_USERNAME/iow-ticket-tracker/actions/workflows/scrape.yml/dispatches`
4. **Schedule:** Custom → Hours: 6–22, Minutes: 0,15,30,45
5. Advanced → **Request method:** POST
6. Advanced → **Headers:**
   - `Authorization` → `Bearer ghp_YOURTOKEN`
   - `Accept` → `application/vnd.github+json`
7. Advanced → **Body:** `{"ref":"main"}`
8. Save and click **Run now** to verify — should return `204 No Content`

### 5. Verify everything works

1. On GitHub → **Actions** tab → confirm a `workflow_dispatch` run succeeded
2. Check `data/snapshots.json` has a new entry
3. Check the Netlify dashboard is showing live data

---

## Day-to-day usage

### Run a manual scrape
GitHub → Actions → "Scrape Twickets Ticket Prices" → **Run workflow**

Or locally:
```bash
cd scraper
npm install
npx playwright install chromium
node scrape.js          # full scrape
node scrape.js --dry-run # preview only, no file write
```

### Debug a failed run
Go to GitHub → Actions → the failed run → scroll to **Artifacts** → download
`failure-screenshot-XXXXX` to see what Twickets showed the scraper.

### Renew the cron-job.org PAT (every 90 days)
1. GitHub → Settings → Developer settings → Personal access tokens → regenerate `iow-cron-trigger`
2. cron-job.org → edit the job → update the `Authorization` header with the new token

### Add IoW 2027

When 2027 tickets go on sale on Twickets:

1. Go to the Twickets event page
2. Copy the event ID from the URL: `twickets.live/en/event/`**`EVENTID`**
3. Open `data/events.json` and update the `2027` section:

```json
"2027": {
  "twicketsEventId": "PASTE_NEW_ID_HERE",
  "twicketsUrl": "https://www.twickets.live/en/event/PASTE_NEW_ID_HERE",
  "faceValues": { "adult_camping": 380 },
  "baselines": {
    "ticketmasterCurrent": 380,
    "ownerEarlyBird": 0,
    "gregsResale": 0
  }
}
```

4. Copy to `public/data/events.json`
5. Commit and push — the scraper picks up the new year automatically

### Update announcement dates

Edit `data/events.json` (and `public/data/events.json`) when dates are confirmed:

```json
"announcements": [
  { "date": "2026-09-24", "type": "lineup_1", "label": "Lineup 1",
    "description": "Headliner announced", "confirmed": true }
]
```

Commit and push — the chart markers update automatically.

### Update Ticketmaster current price

If Ticketmaster changes the price, update `baselines.ticketmasterCurrent` in both
`data/events.json` and `public/data/events.json`, then commit and push.

---

## Project structure

```
iow-ticket-tracker/
├── .github/workflows/scrape.yml   ← GitHub Actions (fallback hourly + daily; primary trigger is cron-job.org)
├── scraper/
│   ├── scrape.js                  ← Playwright scraper (retries 3×, screenshots on failure)
│   ├── package.json
│   └── package-lock.json          ← Required for Actions npm + Playwright cache
├── data/                          ← Source of truth (committed by scraper bot)
│   ├── snapshots.json             ← All price snapshots
│   └── events.json                ← Festival config, baselines, announcements & historical purchases
├── public/                        ← What Netlify serves
│   ├── index.html                 ← Dashboard
│   └── data/                      ← Mirror of data/ (keep in sync)
│       ├── snapshots.json
│       └── events.json
└── netlify.toml
```

> **Note:** `data/` and `public/data/` are kept in sync. The scraper writes `snapshots.json`
> to both automatically. When editing `events.json` manually, copy it to `public/data/events.json`
> before committing.

---

## How the scraper works

1. Launches a headless Chromium browser (via Playwright — cached between runs, ~2 min total)
2. Navigates to the Twickets event page
3. Dismisses the cookie banner
4. Clicks "Load more" until all listings are visible
5. Extracts: price, quantity, tier name, "accepting offers" flag
6. Filters to adult camping tickets only (keyword matching, excludes glamping, car parks, etc.)
7. Computes summary stats and infers likely sold listings (vs previous snapshot)
8. Appends new snapshot to `data/snapshots.json` and `public/data/snapshots.json`, then commits

**Sold price inference:** Listing IDs are not exposed by Twickets. Each listing is fingerprinted
as `price|qty|tier`. When a fingerprint disappears between snapshots, it's logged as likely sold.
Confidence is `high` if the fingerprint was unique, `low` if duplicates existed.

**Empty market:** If Twickets shows 0 adult camping listings, a snapshot is still written with
`marketEmpty: true`. This records dry-market periods and Chart.js renders them as clean gaps.

---

## Adjusting scrape frequency

The primary schedule is controlled in **cron-job.org** (not in the workflow file). To change
frequency, edit the cron-job.org job schedule. Also update `RECENT_WINDOW_MS` in
`scraper/scrape.js` to be slightly under your chosen interval (currently 12 min for 15-min runs).

The GitHub Actions fallback schedule is in `.github/workflows/scrape.yml`:

```yaml
schedule:
  - cron: '0 7-21 * 3-6 *'    # Mar–Jun fallback: hourly 07:00–21:00 UTC
  - cron: '0 8 * 1-2,7-12 *'  # Off-season: once daily 08:00 UTC
```

---

## Tips for buy/sell timing

Based on typical UK festival resale patterns (all prices are all-in):

| Window | Buy signal | Sell signal |
|---|---|---|
| Tickets just on sale | Prices high, wait | Good early sell if you have spares |
| After Lineup 1 (Sep/Oct) | Wait — spike | **Best sell window** |
| Dec–Jan quiet period | **Watch for deals** | Hold |
| After Lineup 2 (Jan/Feb) | Wait — spike | Good sell window |
| 6–8 weeks out | **Best buy window** | Hold |
| 2–3 weeks out | Still ok | Last chance sell |
| Final week | Last resort (prices peak) | **Sell now, urgently** |

The dashboard's **Buy/Sell Signals** tab computes this automatically, comparing all-in resale
prices against the Ticketmaster current price.

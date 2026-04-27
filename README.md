# IoW Festival Ticket Price Tracker

Tracks resale prices for Isle of Wight Festival adult weekend camping tickets on Twickets.
Automatically scrapes every 3 days via GitHub Actions, stores data in JSON, and serves a
live dashboard via Netlify.

**What it does:**
- 📊 Tracks asking prices over time vs face value
- 💸 Infers likely sold prices from listing disappearances
- 🎯 Generates buy/sell timing signals
- 📣 Marks lineup announcement dates on charts
- 🗂 Multi-year — works for 2026, 2027, and beyond

---

## Setup (one-time, ~15 minutes)

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

Then on GitHub: **New repository** → name it `iow-ticket-tracker` → **Private** → don't initialise with README.

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

### 4. Verify GitHub Actions

1. On GitHub, go to your repo → **Actions** tab
2. You should see "Scrape Twickets Ticket Prices" in the list
3. Click it → **Run workflow** → Run manually to test it works
4. After it finishes, check `data/snapshots.json` has a new entry

That's it. The scraper runs automatically every 3 days from here on.

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

### Add IoW 2027

When 2027 tickets go on sale on Twickets:

1. Go to the Twickets event page
2. Copy the event ID from the URL: `twickets.live/en/event/`**`1938221263201767424`**
3. Open `data/events.json` and update the `2027` section:

```json
"2027": {
  "twicketsEventId": "PASTE_NEW_ID_HERE",
  "twicketsUrl": "https://www.twickets.live/en/event/PASTE_NEW_ID_HERE",
  "faceValues": { "adult_camping": 380 }  ← update face value
}
```

4. **Also copy** the updated `events.json` to `public/data/events.json`
5. Commit and push — the scraper picks up the new year automatically

### Update announcement dates

Edit `data/events.json` (and `public/data/events.json`) when dates are confirmed:

```json
"announcements": [
  { "date": "2026-09-24", "type": "lineup_1", "label": "Lineup 1",
    "description": "Coldplay, Olivia Rodrigo headlining", "confirmed": true }
]
```

Commit and push — the chart markers update automatically.

---

## Project structure

```
iow-ticket-tracker/
├── .github/workflows/scrape.yml   ← GitHub Actions schedule (runs every 3 days)
├── scraper/
│   ├── scrape.js                  ← Playwright scraper
│   └── package.json
├── data/                          ← Source of truth (committed by scraper bot)
│   ├── snapshots.json             ← All price snapshots
│   └── events.json                ← Festival config & announcement dates
├── public/                        ← What Netlify serves
│   ├── index.html                 ← Dashboard
│   └── data/                      ← Copy of data/ (keep in sync)
│       ├── snapshots.json
│       └── events.json
└── netlify.toml
```

> **Note:** `data/` and `public/data/` are kept in sync. The scraper writes to `data/` and the
> GitHub Actions workflow commits that. You need to also copy to `public/data/` when updating
> `events.json` manually. The scraper handles `snapshots.json` automatically.

---

## How the scraper works

1. Launches a headless Chromium browser (via Playwright)
2. Navigates to the Twickets event page
3. Dismisses the cookie banner
4. Clicks "Load more" until all listings are visible
5. Extracts: price, quantity, tier name, "accepting offers" flag
6. Filters to adult camping tickets only (keyword matching, excludes glamping, car parks, etc.)
7. Computes summary stats and infers likely sold listings (vs previous snapshot)
8. Appends new snapshot to `data/snapshots.json` and commits

**Sold price inference:** Listing IDs are not exposed by Twickets. Each listing is fingerprinted
as `price|qty|tier`. When a fingerprint disappears between snapshots, it's logged as likely sold.
Confidence is `high` if the fingerprint was unique, `low` if duplicates existed.

---

## Adjusting scrape frequency

Edit `.github/workflows/scrape.yml`:

```yaml
schedule:
  - cron: '0 8 * * *'   # daily at 08:00 UTC — change to '0 8 */3 * *' for every 3 days
```

The scraper skips runs automatically if a snapshot already exists for that day, so running daily
is safe and won't create duplicate entries. You can also trigger manually from the Actions tab.

---

## Tips for buy/sell timing

Based on typical UK festival resale patterns:

| Window | Buy signal | Sell signal |
|---|---|---|
| Tickets just on sale | Prices high, wait | Good early sell if you have spares |
| After Lineup 1 (Sep/Oct) | Wait — spike | **Best sell window** |
| Dec–Jan quiet period | **Watch for deals** | Hold |
| After Lineup 2 (Jan/Feb) | Wait — spike | Good sell window |
| 6–8 weeks out | **Best buy window** | Hold |
| 2–3 weeks out | Still ok | Last chance sell |
| Final week | Last resort (prices peak) | **Sell now, urgently** |

The dashboard's **Buy/Sell Signals** tab computes this automatically from live data.

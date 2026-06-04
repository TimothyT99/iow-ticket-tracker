# IoW Festival Ticket Price Tracker

Tracks resale prices for Isle of Wight Festival adult weekend tickets (camping and non-camping) on Twickets.
Scrapes every 15 minutes via cron-job.org → GitHub Actions, stores data in JSON,
and serves a live dashboard via Netlify.

**What it does:**
- 📊 Tracks all-in prices over time (listed price + ~15.9% Twickets buyer fee)
- ⛺ Captures both camping and non-camping weekend tickets — tagged separately in data and charts
- 💸 Infers likely sold prices from listing disappearances, classified as "likely sold" or "removed/relisted"
- 🎯 Generates buy/sell timing signals vs Ticketmaster current price (camping only)
- 🏷️ Marks key milestones on charts: lineup announcements, sell-out, Ticketmaster transfer window
- 📣 Shows a sold-out banner site-wide when primary sales close
- 📱 Mobile-responsive dashboard
- 🗂 Multi-year — works for 2026, 2027, and beyond

> **2026 status:** IoW Festival 2026 officially sold out on **15 May 2026**. Ticketmaster e-ticket transfers opened **27 May 2026**. Ticketmaster Verified Resale is now live — both Twickets and TM Verified Resale are routes to tickets.

---

## Ticket types tracked

Ticketmaster sells **Camping** and **Non-Camping** weekend tickets at the **same face value**
(£368 standard in 2026). The split is a capacity planning mechanism — Ticketmaster asks which
you intend so they can manage campsite numbers, not a difference in festival access. Both give
full access Thursday–Sunday.

> *"Please let us know if you're planning to camp on-site by choosing the relevant ticket option.
> Whatever you choose, you'll still have access to the site from Thursday to enjoy the full weekend
> of entertainment."* — Ticketmaster booking confirmation

**On resale, the two types behave differently.** Sellers often list non-camping tickets cheaper
(assuming lower demand), and some buyers actively seek them out at a discount if they have camping
sorted elsewhere. This psychological price gap is real even though the underlying product is identical.

Both types are tracked and tagged. **Stats, signals, and primary trend lines use camping tickets**
(more supply). Non-camping is shown as a lighter secondary series on the trends chart and badged
in all tables — so any price divergence is measurable over time.

**Tier classification** (`classifyTier()` in `scraper/scrape.js`, mirrored in the dashboard):

| Priority | Keyword match | Result |
|---|---|---|
| 1 | `glamping`, `ferry`, `car park`, `child`, `coach`, `bus`, `lanyard`, etc. | Excluded |
| 2 | `non-camping`, `no camping`, `non camp`, etc. | `non_camping` |
| 3 | `camping`, `camp` | `camping` |
| 4 | `general admission`, `general admit` | `non_camping` (confirmed real festival tickets) |
| 5 | Anything else | Excluded |

Non-camping keywords are checked before camping keywords to avoid false positives on tiers
like "Weekend Adult Non-Camping" that contain "camping" as a substring. Plain "General Admission"
tiers are confirmed genuine festival tickets on Twickets (verified by direct listing inspection);
ferry/coach add-ons are caught by priority 1 before reaching this check.

---

## Pricing model

All prices shown on the dashboard are **all-in estimates** — the listed asking price plus the
Twickets buyer fee (~15.9% on the transaction price, added at checkout). This makes resale prices
directly comparable to face value purchases where fees are typically bundled.

> Ticketmaster Verified Resale is now live alongside Twickets. Spot prices observed from £200.60 base (28 May 2026) but volatile and not always purchasable — logged in `events.json` as `ticketmasterVerifiedResaleSnapshots` for reference. The `ticketmasterCurrent` signal baseline stays at £320 (last reliable pre-sellout price).

The 15.9% model is accurate to within ~£2 on typical listings. The actual Twickets rate varies
slightly (15–15.93% depending on transaction value) but the overestimate is acceptable for
comparison purposes.

Reference baselines (stored in `public/data/events.json` → `baselines`):

| Baseline | Price | Notes |
|---|---|---|
| Ticketmaster face value | £368 | Standard adult camping — primary sales now closed (sold out 15 May 2026) |
| Ticketmaster last price | £320 | Price at sell-out — no longer purchasable via primary sales |
| Owner early bird | £231.35 | Sky early bird, purchased Jun 2025, fees bundled |
| Resale purchase | £243.45 | Twickets Apr 2026: listed £223, offer £210 accepted + £33.45 fee |

---

## Key events / announcements

Events are stored in `public/data/events.json` → `announcements[]` and drive:
- Vertical marker lines on all three trend charts (colour-coded by type)
- A global sold-out banner across all dashboard tabs
- Banner on the Price Trends tab for upcoming lineup announcements

| Type | Colour | Effect |
|---|---|---|
| `lineup_1`, `lineup_2` | Amber | Trend chart marker + banner when within 30 days |
| `sold_out` | Red | Trend chart marker + global sold-out banner across all tabs |
| `ticket_transfer` | Blue | Trend chart marker only (Ticketmaster opens e-ticket transfers) |
| `policy_change` | Orange | Trend chart marker only (site policy change that may affect demand/supply) |
| `price_is_wight` | — | Recorded in data only, no chart line (resident discount scheme, not a market signal) |

The buy/sell signal logic only reacts to `lineup_1`/`lineup_2` announcements — all other
event types are intentionally excluded from signal proximity calculations.

---

## Scrape schedule

Twickets IoW listings are active between **07:30–21:00 UK time** with zero overnight activity.
At peak season (post sell-out), listings sell within minutes of posting.

| Period | Primary trigger | Fallback | Runs/day |
|---|---|---|---|
| Peak season (Mar–Jun) | cron-job.org every 15 min, 07:00–23:00 BST | GitHub Actions hourly 07:00–21:00 UTC | ~64 |
| Off-season (Jan–Feb, Jul–Dec) | — | GitHub Actions once daily 08:00 UTC | 1 |

**Why cron-job.org?** GitHub's own scheduler throttles `*/15` cron jobs on public repos to
roughly hourly. cron-job.org triggers the workflow via `workflow_dispatch` on a reliable
15-minute schedule. GitHub Actions serves as a fallback if cron-job.org goes down.

**Why keep the repo public?** At 15-min frequency (~2 min/run × 64 runs/day), a private repo
would exhaust the free 2,000 min/month budget in ~15 days. Public repos have unlimited minutes.

The scraper deduplicates within a 12-minute window to prevent double-runs. On concurrent runs
(cron-job.org and the hourly GitHub Actions fallback both fire at :00), the commit step uses
`git push || (git pull --rebase origin main && git push)` to retry cleanly.
On transient Twickets failures the scraper retries up to 3 times (15s, 30s waits).
On failure, a screenshot is uploaded as a GitHub Actions artifact for debugging.

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

### Record a sell-out or key milestone

Edit `public/data/events.json` to add/update the event:

```json
"soldOut": true,
"soldOutDate": "2026-05-15",
"announcements": [
  {
    "date": "2026-05-15",
    "type": "sold_out",
    "label": "Sold Out",
    "description": "IoW Festival 2026 officially sold out — Twickets is now the only route to tickets",
    "confirmed": true
  },
  {
    "date": "2026-05-27",
    "type": "ticket_transfer",
    "label": "TM Transfers",
    "description": "Ticketmaster e-ticket transfers now open",
    "confirmed": true
  }
]
```

Commit and push — the sold-out banner appears immediately, chart markers update on next page load.

### Update lineup announcement dates

Edit `public/data/events.json` when dates are confirmed:

```json
{ "date": "2026-09-24", "type": "lineup_1", "label": "Lineup 1",
  "description": "Headliner announced", "confirmed": true }
```

Commit and push — the chart marker and announcement banner update automatically.

### Update Ticketmaster current price

If Ticketmaster changes the price (or primary sales close), update `baselines.ticketmasterCurrent`
in `public/data/events.json`, then commit and push.

### Add IoW 2027

When 2027 tickets go on sale on Twickets:

1. Go to the Twickets event page
2. Copy the event ID from the URL: `twickets.live/en/event/`**`EVENTID`**
3. Open `public/data/events.json` and update the `2027` section:

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

4. Commit and push — the scraper picks up the new year automatically

---

## Project structure

```
iow-ticket-tracker/
├── .github/workflows/scrape.yml   ← GitHub Actions (fallback hourly + daily; primary trigger is cron-job.org)
├── scraper/
│   ├── scrape.js                  ← Playwright scraper (retries 3×, concurrent-push safe, screenshots on failure)
│   ├── package.json
│   └── package-lock.json          ← Required for Actions npm + Playwright cache
├── data/                          ← Written by scraper bot
│   └── snapshots.json             ← All price snapshots (also mirrored to public/data/)
├── public/                        ← What Netlify serves
│   ├── index.html                 ← Dashboard (single-file, no build step)
│   └── data/
│       ├── snapshots.json         ← Mirror of data/snapshots.json (written by scraper on each run)
│       └── events.json            ← Single source of truth: festival config, baselines, announcements & historical purchases
└── netlify.toml
```

> **`public/data/events.json` is the only copy of events.json.** The scraper reads it directly.
> Edit it in place — no mirroring needed.
>
> `snapshots.json` is written to both `data/` and `public/data/` by the scraper on every run.
> Never edit snapshots.json manually.

---

## Versioning

Code changes use commit messages in the format `type(vX.XXX): description` — e.g. `fix(v1.004): update selectors`. The automated bot commits (`data: snapshot …`) are not versioned. Current code version: **v1.004**.

To tag a release after a code commit:
```bash
git tag v1.004
git push --tags
```

---

## How the scraper works

1. Launches a headless Chromium browser (via Playwright — cached between runs, ~2 min total)
2. Navigates to the Twickets event page
3. Dismisses the cookie banner
4. Clicks "Show more" until all listings are visible
5. Extracts: price, quantity, tier name, "accepting offers" flag
6. Classifies each listing as `camping` or `non_camping` by keyword matching (see Tier classification above); excludes glamping, ferry, car park, child tickets, and other add-ons
7. Computes summary stats for all listings + separate breakdowns by camping / non-camping type
8. Infers likely sold listings vs previous snapshot — fingerprinted as `price|qty|tier`; classified as "likely sold" (all-in ≤ TM price) or "removed/relisted" (all-in > TM price)
9. Appends new snapshot to `data/snapshots.json` and `public/data/snapshots.json`, then commits

**Historical compat:** Older snapshots without a `type` field on each listing are classified
on the fly in the dashboard using the same keyword logic, so all historical data displays correctly.

**Empty market:** If Twickets shows 0 classifiable listings, a snapshot is still written with
`marketEmpty: true`. This records dry-market periods and Chart.js renders them as clean gaps.

**Archive vs dashboard split:** `data/snapshots.json` is the complete archive — full listings[]
data retained forever. `public/data/snapshots.json` is the Netlify-served dashboard copy — 
listings[] stripped from snapshots older than 30 days (summary stats, inferredSold, and all
metadata preserved). This keeps the dashboard payload lean (~2-3 KB/snap for older data vs
~7 KB/snap with full listings) without ever losing raw data.

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

Based on typical UK festival resale patterns (all prices are all-in). **IoW 2026 is sold out —
Ticketmaster primary sales are closed. All windows below now refer to Twickets resale only.**

| Window | Buy signal | Sell signal |
|---|---|---|
| Primary sales open | Buy early bird if available | — |
| After Lineup 1 (Sep/Oct) | Wait — spike | **Best sell window** |
| Dec–Jan quiet period | **Watch for deals** | Hold |
| After Lineup 2 (Jan/Feb) | Wait — spike | Good sell window |
| After sell-out | Prices may spike — act fast on cheap listings | **Good sell window if you have spares** |
| TM transfers open (~3–4 weeks out) | Watch for new supply | Sellers with transfers in hand may list urgently |
| 6–8 weeks out | **Best buy window** (historically) | Hold |
| 2–3 weeks out | Still ok | Last chance sell |
| Final week | Last resort — prices peak | **Sell now, urgently** |

The dashboard's **Buy/Sell Signals** tab computes this automatically, comparing all-in resale
prices against the Ticketmaster reference price.

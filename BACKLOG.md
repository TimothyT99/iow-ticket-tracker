# IoW Ticket Tracker — Backlog & Post-Festival Checklist

---

## 🚨 Pre-Festival Critical (before 18 Jun 2026)

Only ship things that give wrong or misleading information right now. Everything else waits.

- **Buy/sell signal sold-out mode** ← *only real critical item*
  The signal still frames decisions as "vs Ticketmaster price" — but TM is closed.
  Post sell-out the signal should say: "Twickets is the only route. Is this listing
  cheap vs recent market average?" rather than implying TM is an alternative.
  Concretely: when `soldOut: true`, replace TM-comparison language with resale-market
  context and adjust the buy signal threshold logic accordingly.

---

## Phase 1 — Post-Festival Retrospective (Jun–Aug 2026)

The most complete 2026 dataset we'll ever have. Worth mining before moving to 2027.

- **Did the buy window theory hold?**
  Chart all-in floor price by days-to-festival across the whole 2026 season.
  Was the 6–8 week window actually cheapest? Was post-sell-out cheaper or more expensive?

- **Event impact analysis**
  Measure the actual effect of each milestone on supply and price:
  - Sell-out announcement (15 May) — did prices spike immediately?
  - TM ticket transfers opened (27 May) — did supply surge?
  - Bag/trolley policy change (2 Jun) — any non-camping supply increase?
  All the data is there; just needs a retrospective view to surface it.

- **Final 2026 summary card**
  Total listings tracked, estimated % sold, price range seen, floor vs TM last price,
  how the early-bird (£231.35) and Greg's resale (£243.45) compare to the final average.

- **Non-camping discount validation**
  Did non-camping consistently list cheaper? By how much on average?
  Validates (or challenges) the psychological pricing theory.

---

## Phase 2 — 2027 Setup & Prediction (Aug 2026 onwards)

- **Days-to-festival normalised view** ← *highest long-term value*
  Overlay 2026 and 2027 price curves on the same axis (x = days remaining, not date).
  Turns historical data into predictive signal: "In 2026, prices at 60 days out averaged
  £293 all-in — today's 2027 market is at £X." Genuinely useful for buy/sell timing.

- **Price drop alerts**
  Scheduled GitHub Actions job (daily, 08:00 BST) that emails when the all-in floor
  drops below a configurable threshold in events.json (`alertBelowAllIn: 270`).
  More useful than Twickets email alerts which don't include all-in price.
  No backend needed — just a new workflow file.

- **TM Verified Resale chart overlay**
  Plot `ticketmasterVerifiedResaleSnapshots` on the trends chart alongside Twickets.
  Direct daily comparison of the two resale routes.

---

## Phase 3 — Ongoing Improvements (when time allows)

- **Supply velocity metric** — listings/hour disappearance rate. High velocity = hot market.
- **Offer acceptance rate** — what % of "Offers Accepted" listings disappear vs fixed-price.
- **Snapshot size monitor** — show file sizes and last-strip date in Setup tab.
- **CSV export** — download trend dataset for offline analysis.
- **Archive data mining** — `data/snapshots.json` has full listings[] forever. Future analysis
  potential: pricing by tier name, time-of-day patterns, offer behaviour.
- **Mobile chart improvements** — charts on narrow viewports could be more compact.
- **Share a snapshot** — permalink to a specific date's market view.
- **Multi-festival support** — generalise for Glastonbury, Reading, etc.
- **Build step** — pre-aggregate daily summaries at commit time to reduce browser processing.

---

## Post-Festival Operational Checklist

### Final week (11–18 Jun)
- [ ] Watch for supply surge as festival approaches — note any unusual price movements
- [ ] Record TM Verified Resale prices daily if accessible (add to events.json)

### Immediately after festival (21–28 Jun)
- [ ] Keep scraper running 7 days post-close — sellers returning unused tickets still list
- [ ] Record final-week price range and any notable movements in events.json notes
- [ ] Note: did inferredSold hold up? Were final-week disappearances actual sales?

### Within 2 weeks of close
- [ ] Reduce to off-season schedule: pause cron-job.org or set to once-daily
- [ ] Tag `v2026-final` in git for archival reference
- [ ] Update events.json `2026.notes` with final season summary

### When 2027 pre-sale opens (typically July–August)
- [ ] Find the 2027 Twickets event page, copy event ID from URL
- [ ] Update `data/events.json` and `public/data/events.json` — 2027 section:
  ```json
  "twicketsEventId": "PASTE_ID",
  "twicketsUrl": "https://www.twickets.live/en/event/PASTE_ID",
  "faceValues": { "adult_camping": 390 },
  "baselines": { "ticketmasterCurrent": 390, "ownerEarlyBird": 0, "gregsResale": 0 }
  ```
- [ ] Renew cron-job.org PAT if within 90 days of expiry (check expiry date in Token RTF)
- [ ] Re-enable peak scrape schedule on cron-job.org
- [ ] Commit, push, verify first 2027 snapshot appears in dashboard

### Ongoing
- [ ] Record 2027 early-bird purchase in events.json when made (~Jun–Jul 2026)
- [ ] Update `baselines.ownerEarlyBird` once purchased

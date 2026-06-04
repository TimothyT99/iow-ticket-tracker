# IoW Ticket Tracker — Backlog & Post-Festival Checklist

## Enhancement Ideas

### High value / near-term
- **TM Verified Resale chart overlay** — Plot `ticketmasterVerifiedResaleSnapshots` prices on the trends chart alongside Twickets data. Gives direct daily comparison between the two resale routes.
- **Supply velocity metric** — Rate at which listings disappear between snapshots (listings/hour). Useful signal: high velocity = hot market, listings selling fast.
- **Price alert threshold** — Config value in events.json (e.g. `alertBelowPrice: 270`). When any all-in listing drops below it, flag prominently on Market Now tab.
- **Non-camping price gap tracker** — Dedicated stat showing the average % discount non-camping lists at vs camping. Validates the psychological pricing theory over time.

### Medium-term
- **CSV/JSON export button** — Download the full trend dataset from the dashboard for offline analysis.
- **Sold outcome accuracy** — Currently "likely sold" vs "removed/relisted" is inferred. Cross-reference against the Twickets sold count if it becomes accessible.
- **Offer acceptance rate** — What % of "Offers Accepted" listings disappear vs fixed-price. Informs negotiation strategy.
- **Snapshot size monitor** — Show current snapshots.json size and last-strip stats somewhere in the Setup tab.
- **Archive data analysis** — `data/snapshots.json` retains full listings[] forever. Future tooling could mine this for deeper analysis (e.g. price by tier name, offer acceptance patterns, time-of-day listing behaviour).

### Low priority / future
- **Multi-festival support** — Generalise events.json schema to support other festivals (Glastonbury, Reading, etc.) with minimal config changes.
- **Dark/light mode toggle** — Currently dark-only.
- **Share a snapshot** — Permalink to a specific date's market view.
- **Mobile chart improvements** — Charts on narrow viewports could be more compact.
- **Build step** — Pre-aggregate daily summary stats at commit time so the dashboard doesn't need to process 1000+ snapshots in the browser.

---

## Post-Festival Checklist (after ~21 June 2026)

### Immediately after festival (21–28 June)
- [ ] Keep scraper running for 7 days post-festival — last-minute sellers returning unused tickets still list
- [ ] Record any notable final-week price movements in events.json notes
- [ ] Check `inferredSold` accuracy: do final-week listings actually sell or get withdrawn?

### Within 2 weeks of close
- [ ] Reduce scrape to off-season schedule (cron-job.org job: pause or set to once-daily)
- [ ] Tag a `v2026-final` snapshot in git for archival
- [ ] Update events.json `notes` field for 2026 with final summary

### When 2027 pre-sale opens (typically July–August)
- [ ] Go to `twickets.live` → search Isle of Wight Festival 2027
- [ ] Copy the event ID from the URL: `twickets.live/en/event/EVENTID`
- [ ] Update `data/events.json` and `public/data/events.json` — 2027 section:
  ```json
  "twicketsEventId": "PASTE_ID",
  "twicketsUrl": "https://www.twickets.live/en/event/PASTE_ID",
  "faceValues": { "adult_camping": 390 },
  "baselines": { "ticketmasterCurrent": 390, "ownerEarlyBird": 0, "gregsResale": 0 }
  ```
- [ ] Renew cron-job.org PAT if within 90 days of expiry
- [ ] Re-enable peak-season scrape schedule on cron-job.org
- [ ] Commit, push, verify first 2027 snapshot appears

### Ongoing
- [ ] Record owner's 2027 early-bird purchase when made (~June 2026 — check email)
- [ ] Update `baselines.ownerEarlyBird` in events.json once purchased

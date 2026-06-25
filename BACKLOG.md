# IoW Ticket Tracker — Backlog & Post-Festival Checklist

**Status — 23 Jun 2026:** 2026 festival complete (held 18–21 Jun). The tracker is now in **off-season / historical** mode: dashboard defaults to 2027, 2026 is a frozen archive, and the scraper idles cleanly until 2027 goes on sale. See "Shipped" and the "Festival Lifecycle Playbook" below.

**Ownership legend:**
- 🤖 **Claude autonomous** — analysis, code, or data work Claude can do end-to-end
- 🤝 **Claude builds, Tim approves** — Claude writes the code/data; Tim reviews and pushes/deploys
- 👤 **Tim required** — needs Tim's accounts, credentials, purchases, or decisions

---

## ✅ Shipped — 23 Jun 2026 (post-festival break-fix)

Five days after the festival the site was effectively broken and the pipeline was failing silently. Root causes and fixes:

- **Dashboard showed post-festival nonsense.** With the festival date passed, buy/sell signals rendered "Only −5 days to festival — last chance to buy". *Fixed:* signals now show a clean **🏁 Festival Complete** state once `festival.date` is in the past; header shows 🎉; the sold-out banner became a historical-archive banner.
- **Year switch defaulted to the wrong season.** It defaulted to "latest year *with data*", which kept landing on 2026. *Fixed:* now defaults to the latest configured festival year (2027); past seasons are tagged "— complete" in the dropdown; an upcoming year with no event yet shows "isn't on sale yet" instead of a broken empty view.
- **Scraper failed ~100×/day for 5 days** (Seq 2 #6 + #7, below). It kept targeting the finished 2026 event whose Twickets page is gone → `waitForSelector` timed out → 3 retries → exit 1, every 15 min. *Fixed:* see #6/#7.
- **Scheduled tasks kept running post-festival** (daily health-check + 4×/day TM price check) — both tied to the finished 2026 event, both failing on the withdrawn Fable model and the health-check about to false-alarm 🚨 daily (it expects 50+ commits/day). *Fixed:* both disabled; recreate fresh (on the current model) when 2027 opens.
- **Data:** backed up canonical snapshots (2243) + events.json before any change; no data files were touched.

**Follow-up shipped same day — data-quality cleanup + classifier hardening:**
- Found ~2,573 listings misclassified as `camping`: campervan-pitch passes (up to £527), and multi-item lots priced as one total ("1× Car, 1× Weekend camping" £143.75; adult+infant lots; a £58 "facilities" pass). They had crushed the floor (season floor read £67 instead of £227) and inflated the average.
- **Classifier hardened** (scraper + dashboard): added `campervan`/`infant`/`nature calls`/`facilities` exclusions + a **£168 price-plausibility floor**. Dashboard also guards a stored `type:"excluded"` flag and applies the floor at read time. 11/11 unit tests pass (keeps legit £170 ticket and "camping + car park" qty1; drops all bundles/passes).
- **Historical data cleaned:** 2,573 listings re-tagged `type:"excluded"` in both `data/` and `public/data/` snapshots, summaries recomputed; raw price/tier/qty preserved for audit. Backed up first (`iow-tracker-backups/2026-06-23-precleanup/`). 2026 commentary updated to clean figures.
- *Known follow-up:* a few non-camping tiers truncated to "no campin" (missing the 'g') still classify as camping; and `inferredSold[]` still includes the excluded bundles. Minor; candidates for a future pass.

**Meta-learning:** the cutover from *live tracking* → *historical archive* was entirely manual and got missed, so a healthy-looking system rotted quietly for days. The lifecycle below makes that cutover explicit, and the code now degrades gracefully (festival-complete UI state; off-season scraper exits 0) so a missed manual step no longer means failure spam. Worth adding the stale-data canary (Seq 2 #9) so the *next* silent failure pings us within hours.

---

## 🗓 Festival Lifecycle Playbook (reusable each year)

How to handle the tracker through the season. The code now covers most of this automatically; the ⚠️ items still need a human.

| Phase | Window (rel. to festival) | What the system should do | Action needed |
|---|---|---|---|
| **Run-up** | T‑180 → T‑30 | Scrape at chosen cadence; signals vs Ticketmaster | none |
| **Final month** | T‑30 → T‑7 | Peak cadence (15 min); watch supply surges | none |
| **Final week** | T‑7 → T‑0 | Highest cadence; final-week-rise hypothesis is tested here | watch |
| **During festival** | T‑0 → T+3 | Listings dry up fast; empty markets are normal → `marketEmpty`, **not** failure | none (handled by #7) |
| **Post-festival** | T+0 → T+7 | ⚠️ **The danger window.** Twickets event page disappears → scraper must exit 0 (handled by #6). Site must flip to historical. | ⚠️ flip default year (auto), disable event-specific scheduled tasks, tag `vYYYY-final`, write season summary to `events.json` notes |
| **Off-season** | T+7 → next presale | Scraper idles (exit 0 off-season); dashboard defaults to next year "not on sale yet"; cron can be reduced | optional: reduce cron cadence |
| **Next presale opens** | ~T+14+ (early July for 2027) | Wire up next year's `twicketsEventId` + `twicketsUrl` + face values → scraper auto-resumes from next run | ⚠️ set event JSON, recreate scheduled tasks on current model, renew PAT if due |

**Rules of thumb learned in 2026:**
- *An empty or missing market is a normal state, not an error.* Distinguish "dry market" (container present, no listings → `marketEmpty`) from "DOM changed / page gone" (container missing → fail loudly).
- *Anything that countdowns or says "act now" must have a past-date guard.* Negative days-to-festival should never reach user-facing copy.
- *Anything pinned to a single live event (scheduled tasks, signals, banners) needs an explicit end-of-life at festival close.*
- *Calendar year ≠ festival year.* Target the soonest configured upcoming festival, never `getFullYear()`.

---

## 🚨 Pre-Festival Critical (before 18 Jun 2026)

Only ship things that give wrong or misleading information right now. Everything else waits.

- ✅ **DONE** (pre-festival) — **Buy/sell signal sold-out mode** ← *only real critical item*
  The signal still frames decisions as "vs Ticketmaster price" — but TM is closed.
  Post sell-out the signal should say: "Twickets is the only route. Is this listing
  cheap vs recent market average?" rather than implying TM is an alternative.
  Concretely: when `soldOut: true`, replace TM-comparison language with resale-market
  context and adjust the buy signal threshold logic accordingly.

---

## Seq 1 — Post-Festival Retrospective (late Jun–Jul 2026)

The most complete 2026 dataset we'll ever have. Mine it before moving to 2027 —
the outputs calibrate everything in Seq 5.

1. 🤖 **Did the buy window theory hold?**
   Chart all-in floor price by days-to-festival across the whole 2026 season.
   Was the 6–8 week window actually cheapest? Was post-sell-out cheaper or more expensive?

2. 🤖 **Event impact analysis**
   Measure the actual effect of each milestone on supply and price:
   - Sell-out announcement (15 May) — did prices spike immediately?
   - TM ticket transfers opened (27 May) — did supply surge?
   - Bag/trolley policy change (2 Jun) — any non-camping supply increase?

3. 🤖 **Final 2026 summary card**
   Total listings tracked, estimated % sold, price range seen, floor vs TM last price,
   how the early-bird (£231.35) and Greg's resale (£243.45) compare to the final average.

4. 🤖 **Non-camping discount validation**
   Did non-camping consistently list cheaper? By how much on average?
   Validates (or challenges) the psychological pricing theory.

5. 🤖 **inferredSold audit**
   Did final-week disappearances behave like actual sales? Quantify the
   fingerprint false-positive rate (price-edit → "sold + new listing") to
   justify item 19.

---

## Seq 2 — Pre-2027 Plumbing (Jul 2026 — MUST land before 2027 listings appear Jul/Aug)

These are bugs/failure points that will silently kill year-round tracking. Do first.

6. ✅ **DONE 23 Jun 2026** — **Fix year selection** *(actual bug)* — scraper now auto-selects the soonest configured upcoming festival (`twicketsUrl` set, not past) and exits 0 off-season; `getFullYear()` removed.
   `scrape.js` targets `new Date().getFullYear()`. From Jul–Dec 2026 it picks "2026",
   sees the festival is >7 days past, and exits — so 2027 listings would never be
   scraped without hardcoding `--year 2027`. Fix: select the next upcoming festival
   that has a `twicketsUrl` configured, ignoring calendar year.

7. ✅ **DONE 23 Jun 2026** — **Empty market ≠ scraper failure** *(actual bug)* — now waits for the `#tws_ticket-list` container; empty container → `marketEmpty` + exit 0; container missing → still fails loudly (DOM-change canary).
   `waitForSelector('#tws_ticket-list > li')` times out when zero listings exist, so the
   `marketEmpty` snapshot path is unreachable (0 such snaps in 1,611 to date). Off-season
   2027 will have many dry days → every run would fail 3 retries and exit 1.
   Fix: wait for the list container (or "no tickets" message) instead; write `marketEmpty`
   snapshots on genuinely empty pages; fail loudly only when the page structure is
   unrecognisable — which also distinguishes "dry market" from "Twickets redesigned the
   DOM again" (it happened May 2026; over a full year it will happen again).

8. 👤 **Replace the 90-day PAT**
   A 90-day classic token guarantees ≥3 silent-failure windows in a year. Create a
   fine-grained PAT, 1-year expiry, scoped to this repo only; update cron-job.org header;
   set a calendar reminder for renewal. (Claude can draft the steps; token creation is Tim's.)

9. 🤝 **Stale-data canary**
   Alert (email or dashboard banner) if no snapshot has landed in N hours during peak /
   N days off-season — catches dead PAT, dead cron-job.org, or broken DOM without
   anyone having to remember to check.

---

## Seq 3 — Scale for Full-Year Tracking (Aug 2026)

11 MB / 1,611 snapshots in 43 days → a full year at peak cadence is 60–90 MB,
all loaded by the browser on every visit and committed to git ~60×/day.

10. 🤝 **Monthly snapshot sharding + daily summary**
    Scraper writes `snapshots-YYYY-MM.json` plus a one-row-per-day `daily-summary.json`
    (floor/avg/median/count per type). Keeps git diffs small and charts instant.

11. 🤝 **Dashboard lazy-loading**
    Dashboard loads `daily-summary.json` + current month only; older months fetched
    on demand when the user widens the chart range. (Supersedes the old "build step" idea.)

12. 🤝 **Adaptive scrape cadence (self-throttling)**
    One static cron-job.org schedule (every 15 min, year-round 👤 to set); the scraper
    exits early unless its bucket is due, based on `daysToFestival`:
    daily >180d · 4×/day 90–180d · hourly 30–90d · 15-min <30d and post-sellout.
    No more seasonal cron fiddling, no wasted runs.

---

## Seq 4 — 2027 Setup (when pre-sale opens, typically Jul–Aug 2026)

13. 🤝 **Wire up 2027 Twickets event**
    Claude can find the 2027 event ID and face values from the web; Tim sanity-checks,
    then update both `events.json` 2027 sections, commit, verify first snapshot.

14. 👤 **Record 2027 early-bird purchase** (~Jun–Jul 2026)
    Tim makes the purchase and shares the order confirmation; Claude updates
    `historicalBaselines` + `baselines.ownerEarlyBird`.

15. ✅ **DONE 25 Jun 2026 (manual entry) — `primaryPriceHistory[]` series**
    Shipped: per-year `primaryPriceHistory[]` in `events.json` + a "Primary / Pre-Sale Pricing"
    table on the upcoming-year Market tab (date · tier · price · status · notes). Seeded with the
    2027 Tier 1 pre-sale (£259 all-in, camping). **Tim updates rows manually** as each phase releases.
    *Remaining (future):* auto-populate via a scheduled check — see #15b.

15b. 🤖 **Auto pre-sale price check (future years)** — *deferred per Tim, 25 Jun 2026*
    Scheduled task (weekly-ish during pre-sale) that opens the official IoW / Ticketmaster page,
    reads the current on-sale tier + price, and appends/updates a `primaryPriceHistory[]` row when
    it changes. Removes the manual upkeep. Build for 2028+ unless 2027 pre-sale runs long enough to
    warrant it sooner.

16. 🤖 **Lineup announcement watch**
    2026's `lineup_1`/`lineup_2` dates are still `confirmed: false` estimates, which
    weakened the event-impact analysis. Scheduled task: periodically check IoW Festival
    news; when an announcement lands, update `announcements[]` with the confirmed date
    same-day.

---

## Seq 5 — Season Improvements (Sep 2026 onwards)

17. 🤖 **Days-to-festival normalised overlay** ← *highest long-term value*
    Overlay 2026 and 2027 price curves on the same axis (x = days remaining, not date).
    Turns historical data into predictive signal: "In 2026, prices at 60 days out
    averaged £293 all-in — today's 2027 market is at £X."

18. 🤝 **Price drop alerts**
    Daily GitHub Actions job (08:00 BST) that emails when the all-in floor drops below
    a configurable `alertBelowAllIn` threshold in events.json. Claude writes the
    workflow; 👤 Tim adds the email credentials as repo secrets.

19. 🤝 **TM Verified Resale as a first-class series**
    Promote `ticketmasterVerifiedResaleSnapshots` from notes-in-baselines to a proper
    schema the scraper/dashboard understand, plotted on the trends chart alongside
    Twickets for direct daily comparison of the two resale routes.

20. 🤝 **Smarter sold-inference fingerprints**
    `price|qty|tier` reads a seller's price edit as "sold + new listing". If the Twickets
    DOM exposes a listing ID/href, fingerprint on that. Also record the scrape interval
    on each inference — "disappeared within 15 min" vs "within 24 h" (off-season) are
    very different confidence levels. (Calibrate against Seq 1 item 5.)

---

## Seq 6 — Nice-to-Haves (when time allows)

- 🤖 **Supply velocity metric** — listings/hour disappearance rate. High velocity = hot market.
- 🤖 **Offer acceptance rate** — what % of "Offers Accepted" listings disappear vs fixed-price.
- 🤝 **Snapshot size monitor** — show file sizes and last-strip date in Setup tab.
- 🤝 **CSV export** — download trend dataset for offline analysis.
- 🤖 **Archive data mining** — `data/snapshots.json` has full listings[] forever. Pricing by
  tier name, time-of-day patterns, offer behaviour.
- 🤝 **Mobile chart improvements** — charts on narrow viewports could be more compact.
- 🤝 **Share a snapshot** — permalink to a specific date's market view.
- 🤝 **Multi-festival support** — generalise for Glastonbury, Reading, etc.

---

## Post-Festival Operational Checklist

### Final week (11–18 Jun)
- [ ] 🤖 Watch for supply surge as festival approaches — note any unusual price movements
- [ ] 🤝 Record TM Verified Resale prices daily if accessible (add to events.json)

### Immediately after festival (21–28 Jun) — *mostly handled in code as of 23 Jun*
- [x] ✅ Scraper no longer needs babysitting post-close — it exits 0 cleanly once the event page is gone (Seq 2 #6/#7). The old "keep it running 7 days" advice is moot now the page disappears at festival end.
- [x] ✅ Dashboard flipped to historical: defaults to 2027, 2026 archived, Festival-Complete signal state.
- [x] ✅ Event-specific scheduled tasks disabled (TM price check, daily health-check).
- [ ] 🤖 Record final-week price range / notable movements in `events.json` `2026.notes`
- [ ] 🤖 Note: did inferredSold hold up? Were final-week disappearances actual sales? (feeds Seq 1 item 5)

### Within 2 weeks of close
- [ ] 👤 *(Optional)* Reduce cron-job.org cadence — runs are now harmless green no-ops, so not urgent (superseded by adaptive cadence, Seq 3 item 12)
- [ ] 👤 Tag `v2026-final` in git for archival reference
- [ ] 🤝 Update `events.json` `2026.notes` with final season summary

### When 2027 pre-sale opens — **~7–10 days out (early July 2026, per Tim), then quiet until Sep/Oct**
> Expectation set 23 Jun 2026: 2027 resale/presale likely opens in the next 7–10 days. No major changes expected — just **be ready to react quickly**, wire it up, then little activity until the Sep/Oct burst (lineup / main sale). This is the one window in the year that needs prompt attention.
- [ ] 🤝 Find the 2027 Twickets event page, copy event ID from URL (Seq 4 item 13)
- [ ] 🤝 Update `public/data/events.json` — 2027 section:
  ```json
  "twicketsEventId": "PASTE_ID",
  "twicketsUrl": "https://www.twickets.live/en/event/PASTE_ID",
  "faceValues": { "adult_camping": 390 },
  "baselines": { "ticketmasterCurrent": 390, "ownerEarlyBird": 0, "gregsResale": 0 }
  ```
- [ ] 👤 Renew cron-job.org PAT if within 90 days of expiry — or do Seq 2 item 8 now
- [ ] 👤 Re-raise cron-job.org cadence *only if* it was reduced for off-season (scraper itself auto-resumes once `twicketsUrl` is set — no code change needed)
- [ ] 🤝 Recreate the two scheduled tasks (TM price check + daily health-check) — create fresh so they bind to the current model, not the withdrawn Fable one
- [ ] 🤝 Commit, push, verify first 2027 snapshot appears in dashboard (the dashboard's "2027 isn't on sale yet" message flips to live data automatically)

### Ongoing
- [ ] 👤 Record 2027 early-bird purchase in events.json when made (~Jun–Jul 2026)
- [ ] 🤝 Update `baselines.ownerEarlyBird` once purchased

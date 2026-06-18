# #9 — Predict Surface Studio

**Status:** ✅ Done (core + time-travel) · **Effort:** L · **Needs:** — (data verified live) · **Updated:** 2026-06-18

> Live 3-D volatility surface (strike × expiry → IV) from the on-chain SVI, a
> time-travel slider replaying recent updates, and an arbitrage-free checker
> flagging butterfly/calendar violations. (Idea-bank #9.)

## Current state
- 2-D SVI **smile** for one oracle is live (real on-chain params): [SviSmileChart.tsx](../../components/prediction/SviSmileChart.tsx), the "Vol Surface" chart tab in [PredictTerminal.tsx](../../components/prediction/terminal/PredictTerminal.tsx), data via [/api/svi](../../app/api/svi/route.ts).
- **Missing:** 3-D surface across expiries, time-travel, arbitrage-free checker.

## Definition of done
- Interactive **3-D surface** strike × expiry → IV for all active oracles.
- **Time-travel slider** scrubbing historical SVI snapshots.
- **Arb-free checker**: butterfly (strike convexity) + calendar (total-variance monotonic in expiry) violation flags.
- _(optional)_ side-by-side vs Polymarket smile; shape-change alerts.

## Feasibility (verified) — easier than first scoped
- **3-D surface:** fetch `svi/latest` for **all active oracles** (multiple expiries — already listed in the terminal) and evaluate `ivFromRawSvi` across a strike grid per expiry. ✅
- **Time-travel:** ✅ **correction** — the indexer **does** expose SVI history at `GET /oracles/:id/svi` (list, `?limit=` supported). No custom capture needed. (On-chain `suix_queryEvents` is a secondary source.)
- **Arb checker:** pure math over the surface (SVI total variance `w(k)`), client-side. ✅
- Only genuinely new thing: a 3-D render dependency.

## Architecture
- **New route** `app/prediction/surface/page.tsx` (+ nav entry).
- **API** `GET /api/surface`: gather active oracles → for each, latest SVI + forward → return `{expiries:[{expiryMs, forward, params, points[]}]}`. For time-travel, `GET /api/surface/history?at=<ts>` assembling each oracle's SVI nearest `at` from `/oracles/:id/svi`.
- **Surface math** in [lib/svi.ts](../../lib/svi.ts) (extend): grid sampler + total-variance helpers; **arb checks**: butterfly = `w(k)` convex in `k` (2nd difference ≥ 0); calendar = `w(k)` non-decreasing across expiries at matched `k`.
- **3-D render:** add `plotly.js`/`react-plotly.js` (quickest surface) or `@react-three/fiber` (prettier, more work). Recommend Plotly for speed.
- **UI:** surface mesh + expiry/strike axes, hover IV readout, **time slider** (driven by snapshot timestamps), a violations panel listing any butterfly/calendar flags.

## Task checklist
- [x] `GET /api/surface` (multi-oracle latest SVI → mesh data). → [route.ts](../../app/api/surface/route.ts)
- [x] Time-travel data via `GET /api/surface?at=<ms>` (extended the existing route; per-oracle SVI + price history nearest the timestamp; time-to-expiry measured from the scrub time).
- [x] Extend `lib/svi.ts`: surface grid sampler + butterfly/calendar arb checks. → `ivAcrossMoneyness`, `butterflyG`, `calendarBreaches` _(unit tests still TODO)_
- [x] ~~Add 3-D lib (Plotly)~~ → **changed to a dependency-free isometric SVG** (fast compile, themeable, no SSR/bundle cost).
- [x] `/prediction/surface` page: surface mesh + hover (`<title>`) + axes. → [SurfaceStudio.tsx](../../components/prediction/surface/SurfaceStudio.tsx)
- [x] Heatmap alternate view (Surface/Heatmap shadcn Tabs).
- [x] Arb-violations panel (butterfly + calendar, shadcn Badges) + ATM term-structure panel.
- [x] Nav entry ("Surface") + indexer `oracleSviHistory` method (for time-travel).
- [x] Time-travel slider (Live pill + scrub + relative-time label) wired to history; graceful empty state when scrubbed past the current oracles' data.
- [ ] _(optional, deferred)_ Polymarket smile overlay; shape-change alert.
- [ ] _(deferred)_ Unit tests for the arb checks.

## Risks / open questions
- Plotly bundle size / SSR — load client-only via dynamic import.
- History granularity/volume per oracle (use `?limit=` + downsample for the slider).
- Few simultaneous expiries → surface may be sparse; interpolate or show as ridge lines.

## Acceptance criteria
- [x] Surface renders from live multi-oracle SVI and updates on refresh. _(verified: 10 expiries, isometric waterfall + heatmap)_
- [x] Time slider replays past surface states from the SVI history endpoint. _(verified: scrubbed to −34m, rendered the historical surface with correct historical time-to-expiry; graceful empty past the data boundary)_
- [x] Checker flags butterfly/calendar violations (shows none on a clean surface). _(verified: caught a real transient `calendarBreaches: 13 (115m→130m)`; clean otherwise)_

## Progress log
- _2026-06-18_ — doc created; not started.
- _2026-06-18_ — **core shipped & verified.** Added `lib/svi.ts` `ivAcrossMoneyness`/`butterflyG`/`calendarBreaches`; `indexer.oracleSviHistory`; `GET /api/surface`; `components/prediction/surface/SurfaceStudio.tsx` (dependency-free isometric waterfall + heatmap toggle, depth slider, IV legend, no-arb panel, ATM term structure — all shadcn); `app/prediction/surface/page.tsx`; nav "Surface" entry. Type-clean, no console errors. Live data: 10 expiries, downward-sloping ATM term structure (~40%→34%), arb checks working. **Remaining:** time-travel slider (`/api/surface/history` + UI), optional Polymarket overlay, unit tests. _Note: testnet indexer is intermittently timing out (`fetch failed`) — environmental; the API returns ok once it's reachable._
- _2026-06-18_ — **time-travel shipped & verified → #9 done.** Extended `GET /api/surface` with `?at=<ms>` (per-oracle SVI+price history nearest the scrub time; time-to-expiry measured from `at`); added the Live-pill + scrub slider to `SurfaceStudio` with relative-time label, historical/live footer, and a graceful empty state. Narrowed the scrub window to 20m so it lands inside the current oracles' history. Verified: scrub to −34m renders the historical surface (10 expiries, correct historical TTE), −48m correctly shows the empty state (those oracles didn't exist yet). Type-clean. **Deferred (optional):** Polymarket overlay, arb-check unit tests.

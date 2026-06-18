# #6 — Streaks & Leaderboard PWA

**Status:** ⬜ Not started · **Effort:** M–L · **Needs:** 🗄️ off-chain backend on · **Updated:** 2026-06-18

> Daily binary picks ("BTC up or down by close"), per-user streaks, weekly prize
> pools — a gamified retention loop, installable as a PWA. (Idea-bank #6.)

## Current state
- **Leaderboard** live (IV-Edge): [PredictLeaderboard.tsx](../../components/prediction/PredictLeaderboard.tsx), `/prediction/top-traders`, `/social/leaderboard`, [/api/leaderboard](../../app/api/leaderboard/route.ts).
- **Competitions / prize pools** exist: [components/competition](../../components/competition), `/competition`.
- **Daily-active tracking** already logs events: [useDailyActiveTracking.ts](../../hooks/useDailyActiveTracking.ts) (Privy + `dexBackendApi` + `EventType`).
- **Social graph** (follow/copy): [SocialFeed.tsx](../../components/social/SocialFeed.tsx), follow hooks.
- **Missing:** the **streak** mechanic, a **daily-pick** flow, **NFT badges**, and **PWA** install (no manifest/service worker).

## Definition of done
- A daily one-tap "BTC up/down by close" pick with settlement reveal.
- Per-user **current + longest streak**, surfaced on profile/leaderboard.
- Streaks feed **weekly prize pools** (eligibility/scoring).
- App is an installable **PWA** (manifest + service worker), mobile-first on the predict pages.
- _(optional)_ NFT streak badges.

## Feasibility (verified)
- No Predict-protocol changes needed. Streaks/competitions ride the **off-chain DEX backend** (already logging daily-active events). ✅
- PWA is pure frontend (Next App Router supports `app/manifest.ts`). ✅
- ⛔ Gated on `NEXT_PUBLIC_DEX_API_BASE_URL` being set (backend live). Confirm we control that backend (add streak endpoints) or compute streaks client-side from event history.

## Architecture
- **Streak engine:** prefer a backend endpoint (`GET /streak?addr=` → `{current, longest, lastPickDay}`) computed from the daily-pick event stream; fallback = derive client-side from existing daily-active events.
- **Daily pick:** a lightweight market card (reuse the soonest binary oracle) writing a `DailyPick` event (and optionally an on-chain `predict::mint` for real stakes); reveal result at settlement.
- **Prize pools:** extend competitions — add streak-based scoring/eligibility in [components/competition](../../components/competition).
- **PWA:** `app/manifest.ts` (name, icons, `display: standalone`, theme color) + service worker (e.g. `@ducanh2912/next-pwa` or a hand-rolled SW) + install prompt; mobile-first audit of `/prediction`.
- **Badges (optional):** Sui Move NFT mint on streak milestones, or off-chain badge records first.

## Task checklist
- [ ] Confirm backend ownership / whether streak endpoints can be added (else client-side compute).
- [ ] Define streak rule (consecutive pick-days vs consecutive correct calls) + reset semantics.
- [ ] Streak endpoint (or client computation) + `useStreak` hook.
- [ ] Daily-pick UI + settlement reveal.
- [ ] Wire streaks into competition scoring / weekly pools.
- [ ] `app/manifest.ts` + icons + service worker + install prompt.
- [ ] Mobile-first pass on the predict pages.
- [ ] _(optional)_ NFT badge mint on milestones.

## Risks / open questions
- Backend is unset in dev → need a live instance (or a client-side MVP) to demo.
- Streak gaming (multi-wallet) — scope acceptable for hackathon.

## Acceptance criteria
- [ ] Make a daily pick; streak increments; breaks on a missed day.
- [ ] Streak visible on leaderboard/profile; feeds a weekly pool.
- [ ] App installs to home screen (Lighthouse PWA pass) and is usable on mobile.

## Progress log
- _2026-06-18_ — doc created; not started.

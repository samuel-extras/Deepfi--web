// Demo-bot scheduler: pings the app's /api/demo endpoint on an interval so the
// configured bot wallets keep placing real DeepBook Predict trades, keeping the
// live feed populated. The trading logic + keys live server-side in the app
// (lib/demoBots.ts) — this script is just the clock.
//
// Usage:
//   DEMO_TICK_URL=http://localhost:3000/api/demo \
//   DEMO_TICK_SECRET=your-secret \
//   DEMO_TICK_INTERVAL_MIN=5 \
//   node scripts/demo-bots.mjs
//
// Requires the Next app running with DEMO_BOT_KEYS set (see scripts/demo-bots.md).

const URL = process.env.DEMO_TICK_URL ?? "http://localhost:3000/api/demo";
const SECRET = process.env.DEMO_TICK_SECRET ?? "";
const INTERVAL_MIN = Number(process.env.DEMO_TICK_INTERVAL_MIN ?? "5");

function stamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

async function tick() {
  try {
    const url = SECRET ? `${URL}?secret=${encodeURIComponent(SECRET)}` : URL;
    const res = await fetch(url, { method: "POST" });
    const json = await res.json();
    if (!json.ok) {
      console.log(`[${stamp()}] tick failed: ${json.error ?? res.status}`);
      return;
    }
    console.log(`[${stamp()}] ${json.traded}/${json.total} bots traded`);
    for (const r of json.results ?? []) {
      const who = r.address.slice(0, 10) + "…";
      if (r.ok) console.log(`    ✓ ${who}  ${r.action}  (${r.digest?.slice(0, 10)}…)`);
      else console.log(`    · ${who}  ${r.skipped ?? r.error}`);
    }
  } catch (e) {
    console.log(`[${stamp()}] tick error: ${e?.message ?? e}`);
  }
}

console.log(`demo-bots: POST ${URL} every ${INTERVAL_MIN} min`);
await tick(); // fire immediately
setInterval(tick, INTERVAL_MIN * 60_000);

// DeepBook Predict settled-redeem keeper (Sui TESTNET) — hackathon idea #8.
//
// Watches for settled Predict oracles, scans the predict-server indexer for
// BINARY positions stuck in status "redeemable", and claims their payouts on
// the owners' behalf via predict::redeem_permissionless (payouts are deposited
// straight into each owner's PredictManager balance; the keeper only pays gas).
// Up to MAX_REDEEMS_PER_TX redeems are batched into a single PTB.
//
// NOTE: only BINARY positions can be redeemed permissionlessly. Ranges have NO
// permissionless redeem on chain — predict::redeem_range asserts
// `ctx.sender() == manager.owner()` — so this keeper handles binaries only.
//
// Usage:
//   node scripts/redeem-keeper.mjs                  # one scan, dry-run (devInspect)
//   node scripts/redeem-keeper.mjs --watch 30       # poll every 30s
//   SPOT_KEY=suiprivkey1... node scripts/redeem-keeper.mjs --execute
//
// Call shape mirrors buildRedeemPermissionlessTx in lib/ptb/predict.ts:
//   key = market_key::up|down(oracle_id, expiry, strike)
//   predict::redeem_permissionless<DUSDC>(predict, manager, oracle, key, qty, clock)

import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

const RPC = "https://fullnode.testnet.sui.io:443";
const INDEXER = "https://predict-server.testnet.mystenlabs.com";

// Testnet IDs pinned to predict-testnet-4-16 (same values as lib/deepbook.ts).
const PREDICT_PKG = "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138";
const DUSDC_PKG = "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a";
const PREDICT_OBJ = "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a";
const CLOCK = "0x6";
const DUSDC = `${DUSDC_PKG}::dusdc::DUSDC`;

const T = {
  redeemPermissionless: `${PREDICT_PKG}::predict::redeem_permissionless`,
  marketKeyUp: `${PREDICT_PKG}::market_key::up`,
  marketKeyDown: `${PREDICT_PKG}::market_key::down`,
};

const MAX_REDEEMS_PER_TX = 10;
// Scan breadth cap: only the most recently created managers are scanned each
// pass (one positions/summary fetch per manager). Raise if you run 24/7.
const MANAGER_SCAN_LIMIT = 60;
const FETCH_CONCURRENCY = 8;
const DEV_SENDER =
  "0xd3e835d573c126bb7f5266f3d5390cdf0eba7bf05984316cfb0675f4be362b91";

const client = new SuiJsonRpcClient({ url: RPC, network: "testnet" });
const log = (m) => console.log(`[redeem-keeper ${new Date().toISOString()}] ${m}`);

// Positions already redeemed (or attempted) this session — the indexer lags a
// few checkpoints behind execution, so skip repeats between watch iterations.
const attempted = new Set();
const positionKey = (p) =>
  `${p.manager_id}|${p.oracle_id}|${p.expiry}|${p.strike}|${p.is_up}`;

function parseArgs() {
  const execute = process.argv.includes("--execute");
  const wi = process.argv.indexOf("--watch");
  const watchSec = wi >= 0 ? Number(process.argv[wi + 1] || 30) : null;
  return { execute, watchSec };
}

async function api(path) {
  const res = await fetch(`${INDEXER}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`indexer ${res.status} ${path}`);
  return res.json();
}

/** Build one PTB redeeming up to MAX_REDEEMS_PER_TX binary positions. */
function buildRedeemBatch(sender, items) {
  const tx = new Transaction();
  tx.setSender(sender);
  for (const p of items) {
    const key = tx.moveCall({
      target: p.is_up ? T.marketKeyUp : T.marketKeyDown,
      arguments: [
        tx.pure.id(p.oracle_id),
        tx.pure.u64(p.expiry),
        tx.pure.u64(String(p.strike)), // raw 1e9 strike straight from the indexer
      ],
    });
    tx.moveCall({
      target: T.redeemPermissionless,
      typeArguments: [DUSDC],
      arguments: [
        tx.object(PREDICT_OBJ),
        tx.object(p.manager_id),
        tx.object(p.oracle_id),
        key,
        tx.pure.u64(p.open_quantity),
        tx.object(CLOCK),
      ],
    });
  }
  return tx;
}

/** Map with a small concurrency cap (the indexer is a shared testnet service). */
async function mapLimited(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

/** Find redeemable binary positions across the most recent managers. */
async function findRedeemables() {
  const oracles = await api(`/predicts/${PREDICT_OBJ}/oracles`);
  const settled = new Set(
    oracles.filter((o) => o.status === "settled").map((o) => o.oracle_id)
  );
  log(`oracles: ${oracles.length} total, ${settled.size} settled`);

  const managers = (await api(`/managers`))
    .sort((a, b) => b.checkpoint_timestamp_ms - a.checkpoint_timestamp_ms)
    .slice(0, MANAGER_SCAN_LIMIT);
  log(`scanning ${managers.length} most recent managers (cap ${MANAGER_SCAN_LIMIT})`);

  const perManager = await mapLimited(managers, FETCH_CONCURRENCY, async (m) => {
    const rows = await api(`/managers/${m.manager_id}/positions/summary`).catch(() => []);
    return rows.filter(
      (r) =>
        r.status === "redeemable" &&
        r.open_quantity > 0 &&
        settled.has(r.oracle_id) &&
        !attempted.has(positionKey(r))
    );
  });
  return perManager.flat();
}

async function scan({ execute, keypair }) {
  const sender = keypair ? keypair.toSuiAddress() : DEV_SENDER;
  const redeemables = await findRedeemables();
  const totalValue = redeemables.reduce((s, r) => s + (r.mark_value ?? 0), 0);
  log(
    `redeemable binary positions: ${redeemables.length}` +
      (redeemables.length ? ` (≈$${(totalValue / 1e6).toFixed(2)} payout owed to owners)` : "")
  );

  for (let i = 0; i < redeemables.length; i += MAX_REDEEMS_PER_TX) {
    const batch = redeemables.slice(i, i + MAX_REDEEMS_PER_TX);
    for (const p of batch) {
      log(
        `  · ${p.manager_id.slice(0, 10)}… ${p.is_up ? "UP" : "DOWN"} @ $${(p.strike / 1e9).toLocaleString()} qty=${p.open_quantity} mark=$${((p.mark_value ?? 0) / 1e6).toFixed(2)}`
      );
    }
    try {
      const tx = buildRedeemBatch(sender, batch);
      const sim = await client.devInspectTransactionBlock({
        sender,
        transactionBlock: tx,
      });
      const okSim = sim.effects?.status?.status === "success";
      log(
        `  ${okSim ? `✓ batch of ${batch.length} redeem(s) simulates OK` : `✗ ${sim.effects?.status?.error?.slice(0, 120)}`}`
      );
      if (okSim && execute && keypair) {
        const res = await client.signAndExecuteTransaction({
          signer: keypair,
          transaction: buildRedeemBatch(sender, batch),
          options: { showEffects: true },
        });
        if (res.effects?.status?.status === "success") {
          log(`  ⚡ REDEEMED ${batch.length} position(s) — ${res.digest}`);
          batch.forEach((p) => attempted.add(positionKey(p)));
        } else log(`  ✗ execution failed: ${res.effects?.status?.error}`);
      }
    } catch (e) {
      log(`  ✗ ${String(e).slice(0, 140)}`);
    }
  }
  return redeemables.length;
}

/**
 * Encoding self-test: devInspect a redeem_permissionless PTB against a real
 * settled oracle + manager with a synthetic key (strike = min_strike, qty 1).
 * The position won't exist, so a MoveAbort (in decrease_position) is the
 * expected proof that target, type args and argument order all encode — only
 * a non-Move failure (resolution/type error) fails the test.
 */
async function encodingSelfTest() {
  const oracles = await api(`/predicts/${PREDICT_OBJ}/oracles`);
  const oracle = oracles
    .filter((o) => o.status === "settled")
    .sort((a, b) => (b.settled_at ?? 0) - (a.settled_at ?? 0))[0];
  const manager = (await api(`/managers`)).sort(
    (a, b) => b.checkpoint_timestamp_ms - a.checkpoint_timestamp_ms
  )[0];
  if (!oracle || !manager) return log("self-test skipped (no settled oracle / manager)");

  const tx = buildRedeemBatch(DEV_SENDER, [
    {
      manager_id: manager.manager_id,
      oracle_id: oracle.oracle_id,
      expiry: oracle.expiry,
      strike: oracle.min_strike, // on the oracle grid by definition
      is_up: true,
      open_quantity: 1,
    },
  ]);
  const sim = await client.devInspectTransactionBlock({
    sender: DEV_SENDER,
    transactionBlock: tx,
  });
  const status = sim.effects?.status;
  if (status?.status === "success")
    log(`self-test ✓ redeem_permissionless simulates on ${oracle.oracle_id.slice(0, 10)}…`);
  else if (String(status?.error).includes("MoveAbort"))
    log(
      `self-test ✓ call encodes (expected MoveAbort — synthetic position doesn't exist): ${String(status?.error).slice(0, 110)}…`
    );
  else log(`self-test ✗ ${String(status?.error).slice(0, 140)}`);
}

async function main() {
  const { execute, watchSec } = parseArgs();
  let keypair = null;
  if (execute) {
    const pk = process.env.SPOT_KEY;
    if (!pk) throw new Error("--execute needs SPOT_KEY");
    const { schema, secretKey } = decodeSuiPrivateKey(pk);
    if (schema !== "ED25519") throw new Error(`unsupported scheme ${schema}`);
    keypair = Ed25519Keypair.fromSecretKey(secretKey);
    log(`executing as ${keypair.toSuiAddress()}`);
  } else {
    log("dry-run (devInspect only) — pass --execute with SPOT_KEY to submit");
  }

  await encodingSelfTest();

  if (watchSec) {
    log(`watching every ${watchSec}s — ctrl-c to stop`);
    // sequential loop (no overlapping scans)
    for (;;) {
      try {
        await scan({ execute, keypair });
      } catch (e) {
        log(`scan error: ${String(e).slice(0, 140)}`);
      }
      await new Promise((r) => setTimeout(r, watchSec * 1000));
    }
  } else {
    await scan({ execute, keypair });
    log("done (single scan — use --watch 30 to keep running)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

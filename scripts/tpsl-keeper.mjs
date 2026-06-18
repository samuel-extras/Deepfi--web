// DeepBook Margin TP/SL execution keeper (Sui TESTNET).
//
// Conditional orders only fire when someone calls
// margin_manager::execute_conditional_orders (permissionless). This keeper
// scans the indexer for managers whose oracle price has crossed an armed
// trigger and executes them:
//   pyth refresh → execute_conditional_orders(manager, pool, oracles,
//   registry, max_orders, clock)
//
// Usage:
//   node scripts/tpsl-keeper.mjs                   # one scan, dry-run (devInspect)
//   node scripts/tpsl-keeper.mjs --watch 20        # poll every 20s
//   SPOT_KEY=suiprivkey1... node scripts/tpsl-keeper.mjs --execute
//
// Trigger semantics (from the protocol): trigger_below fires when price falls
// BELOW the trigger; trigger_above fires when price rises ABOVE it. The
// indexer exposes per-manager `highest_trigger_below_price`,
// `lowest_trigger_above_price` (raw, FLOAT-scaled) and `current_price`.

import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import {
  DeepBookClient,
  testnetPackageIds,
  testnetPools,
  testnetCoins,
} from "@mysten/deepbook-v3";

const RPC = "https://fullnode.testnet.sui.io:443";
const INDEXER = "https://deepbook-indexer.testnet.mystenlabs.com";
const MPKG = testnetPackageIds.MARGIN_PACKAGE_ID;
const MREG = testnetPackageIds.MARGIN_REGISTRY_ID;
const MAX_ORDERS_PER_TX = 10;
const U64_MAX = 18446744073709551615n;
const DEV_SENDER =
  "0xd3e835d573c126bb7f5266f3d5390cdf0eba7bf05984316cfb0675f4be362b91";

const client = new SuiJsonRpcClient({ url: RPC, network: "testnet" });
const poolByAddress = Object.fromEntries(
  Object.entries(testnetPools).map(([key, p]) => [p.address, { key, ...p }])
);
const log = (m) => console.log(`[tpsl-keeper ${new Date().toISOString()}] ${m}`);

function parseArgs() {
  const execute = process.argv.includes("--execute");
  const wi = process.argv.indexOf("--watch");
  const watchSec = wi >= 0 ? Number(process.argv[wi + 1] || 20) : null;
  return { execute, watchSec };
}

/** Managers with at least one armed conditional order. */
async function armedManagers() {
  const res = await fetch(`${INDEXER}/margin_manager_states?max_risk_ratio=10000`);
  if (!res.ok) throw new Error(`indexer ${res.status}`);
  const rows = await res.json();
  return rows
    .map((r) => ({
      ...r,
      below: BigInt(r.highest_trigger_below_price ?? 0),
      above: BigInt(r.lowest_trigger_above_price ?? U64_MAX),
      price: BigInt(r.current_price ?? 0),
    }))
    .filter((r) => r.below > 0n || r.above < U64_MAX);
}

function triggered(r) {
  // price strictly below the highest below-trigger, or above the lowest above-trigger
  return (r.below > 0n && r.price < r.below) || (r.above < U64_MAX && r.price > r.above);
}

async function buildExecute(db, sender, row, pool) {
  const tx = new Transaction();
  tx.setSender(sender);
  await db.getPriceInfoObjects(tx, [pool.baseCoin, pool.quoteCoin]);
  tx.moveCall({
    target: `${MPKG}::margin_manager::execute_conditional_orders`,
    arguments: [
      tx.object(row.margin_manager_id),
      tx.object(pool.address),
      tx.object(testnetCoins[pool.baseCoin].priceInfoObjectId),
      tx.object(testnetCoins[pool.quoteCoin].priceInfoObjectId),
      tx.object(MREG),
      tx.pure.u64(MAX_ORDERS_PER_TX),
      tx.object.clock(),
    ],
    typeArguments: [
      testnetCoins[pool.baseCoin].type,
      testnetCoins[pool.quoteCoin].type,
    ],
  });
  return tx;
}

async function scan({ execute, keypair }) {
  const sender = keypair ? keypair.toSuiAddress() : DEV_SENDER;
  const db = new DeepBookClient({ client, network: "testnet", address: sender });

  const rows = await armedManagers();
  log(`managers with armed TP/SL: ${rows.length}`);

  for (const row of rows) {
    const pool = poolByAddress[row.deepbook_pool_id];
    if (!pool) continue;
    const fire = triggered(row);
    log(
      `  ${fire ? "⚡" : "·"} ${row.margin_manager_id.slice(0, 10)}… ${pool.key} price=${row.price} below@${row.below > 0n ? row.below : "—"} above@${row.above < U64_MAX ? row.above : "—"}${fire ? " — TRIGGERED" : ""}`
    );
    if (!fire) continue;

    try {
      const tx = await buildExecute(db, sender, row, pool);
      const sim = await client.devInspectTransactionBlock({
        sender,
        transactionBlock: tx,
      });
      const okSim = sim.effects?.status?.status === "success";
      log(
        `    ${okSim ? "✓ execution simulates OK" : `✗ ${sim.effects?.status?.error?.slice(0, 110)}`}`
      );
      if (okSim && execute && keypair) {
        const tx2 = await buildExecute(db, sender, row, pool);
        const res = await client.signAndExecuteTransaction({
          signer: keypair,
          transaction: tx2,
          options: { showEffects: true },
        });
        if (res.effects?.status?.status === "success")
          log(`    ⚡ EXECUTED — ${res.digest}`);
        else log(`    ✗ execution failed: ${res.effects?.status?.error}`);
      }
    } catch (e) {
      log(`    ✗ ${String(e).slice(0, 120)}`);
    }
  }
  return rows.length;
}

/** Encoding self-test: executing a manager with NO armed orders is a no-op. */
async function encodingSelfTest() {
  const res = await fetch(`${INDEXER}/margin_managers_info`);
  const infos = await res.json();
  const target = infos.find((m) => poolByAddress[m.deepbook_pool_id]);
  if (!target) return log("self-test skipped (no managers)");
  const pool = poolByAddress[target.deepbook_pool_id];
  const db = new DeepBookClient({ client, network: "testnet", address: DEV_SENDER });
  const tx = await buildExecute(db, DEV_SENDER, { margin_manager_id: target.margin_manager_id }, pool);
  const sim = await client.devInspectTransactionBlock({
    sender: DEV_SENDER,
    transactionBlock: tx,
  });
  if (sim.effects?.status?.status === "success")
    log(`self-test ✓ execute_conditional_orders(no-op) simulates on ${target.margin_manager_id.slice(0, 10)}…`);
  else log(`self-test ✗ ${sim.effects?.status?.error?.slice(0, 140)}`);
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
  }

  await encodingSelfTest();

  if (watchSec) {
    log(`watching every ${watchSec}s — ctrl-c to stop`);
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
    log("done (single scan — use --watch 20 to keep running)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// DeepBook Margin liquidation keeper (Sui TESTNET).
//
// Scans the indexer for margin managers at/under the liquidation risk ratio,
// then (dry-run by default) simulates the liquidation PTB the protocol expects:
//   pyth refresh → margin_manager::liquidate(repay coin) → transfer payouts.
// Liquidators repay debt and receive collateral + ~2% reward.
//
// Usage:
//   node scripts/liquidation-keeper.mjs                  # one scan, dry-run
//   node scripts/liquidation-keeper.mjs --watch 30       # poll every 30s
//   SPOT_KEY=suiprivkey1... node scripts/liquidation-keeper.mjs --execute
//     (needs the DEBT asset in the keeper wallet to fund repayment)

import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { coinWithBalance } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import {
  DeepBookClient,
  testnetPools,
  testnetCoins,
} from "@mysten/deepbook-v3";

const RPC = "https://fullnode.testnet.sui.io:443";
const INDEXER = "https://deepbook-indexer.testnet.mystenlabs.com";
const LIQUIDATION_RISK_RATIO = 1.1;
const DEV_SENDER =
  "0xd3e835d573c126bb7f5266f3d5390cdf0eba7bf05984316cfb0675f4be362b91";

const client = new SuiJsonRpcClient({ url: RPC, network: "testnet" });
const poolByAddress = Object.fromEntries(
  Object.entries(testnetPools).map(([key, p]) => [p.address, { key, ...p }])
);

const log = (m) => console.log(`[keeper ${new Date().toISOString()}] ${m}`);

function parseArgs() {
  const execute = process.argv.includes("--execute");
  const wi = process.argv.indexOf("--watch");
  const watchSec = wi >= 0 ? Number(process.argv[wi + 1] || 30) : null;
  return { execute, watchSec };
}

async function liquidatable() {
  const res = await fetch(
    `${INDEXER}/margin_manager_states?max_risk_ratio=${LIQUIDATION_RISK_RATIO}`
  );
  if (!res.ok) throw new Error(`indexer ${res.status}`);
  const rows = await res.json();
  // ignore empty husks (no debt at all)
  return rows.filter(
    (r) => Number(r.base_debt) > 0 || Number(r.quote_debt) > 0
  );
}

async function buildLiquidation(db, sender, row, pool) {
  const debtIsBase = Number(row.base_debt) > 0;
  const debtCoinKey = debtIsBase ? pool.baseCoin : pool.quoteCoin;
  const debtCoin = testnetCoins[debtCoinKey];
  // indexer returns HUMAN-scaled decimals (e.g. "0.18036500000000000000")
  const debtHuman = Number(debtIsBase ? row.base_debt : row.quote_debt);

  const tx = new Transaction();
  tx.setSender(sender);
  await db.getPriceInfoObjects(tx, [pool.baseCoin, pool.quoteCoin]);
  const repayCoin = coinWithBalance({
    type: debtCoin.type,
    balance: BigInt(Math.ceil(debtHuman * 1.04 * debtCoin.scalar)), // + pool reward headroom
  });
  const [baseOut, quoteOut, debtOut] = tx.add(
    db.marginManager.liquidate(
      row.margin_manager_id,
      pool.key,
      debtIsBase,
      repayCoin
    )
  );
  tx.transferObjects([baseOut, quoteOut, debtOut], sender);
  return { tx, debtIsBase, debtCoinKey, debtHuman };
}

async function scan({ execute, keypair }) {
  const sender = keypair ? keypair.toSuiAddress() : DEV_SENDER;
  const db = new DeepBookClient({ client, network: "testnet", address: sender });

  const rows = await liquidatable();
  log(`liquidatable managers (risk ≤ ${LIQUIDATION_RISK_RATIO}): ${rows.length}`);

  for (const row of rows) {
    const pool = poolByAddress[row.deepbook_pool_id];
    if (!pool) {
      log(`  · ${row.margin_manager_id.slice(0, 10)}… unknown pool — skip`);
      continue;
    }
    try {
      const { tx, debtCoinKey, debtHuman } = await buildLiquidation(
        db,
        sender,
        row,
        pool
      );
      const sim = await client.devInspectTransactionBlock({
        sender,
        transactionBlock: tx,
      });
      const okSim = sim.effects?.status?.status === "success";
      log(
        `  ${okSim ? "✓" : "✗"} ${row.margin_manager_id.slice(0, 10)}… ${pool.key} risk=${Number(row.risk_ratio).toFixed(3)} debt=${debtHuman.toFixed(4)} ${debtCoinKey}${okSim ? " — liquidation simulates OK" : ` — ${sim.effects?.status?.error?.slice(0, 110)}`}`
      );

      if (okSim && execute && keypair) {
        const { tx: tx2 } = await buildLiquidation(db, sender, row, pool);
        const res = await client.signAndExecuteTransaction({
          signer: keypair,
          transaction: tx2,
          options: { showEffects: true },
        });
        if (res.effects?.status?.status === "success")
          log(`  ⚡ LIQUIDATED ${row.margin_manager_id.slice(0, 10)}… — ${res.digest}`);
        else log(`  ✗ execution failed: ${res.effects?.status?.error}`);
      }
    } catch (e) {
      log(`  ✗ ${row.margin_manager_id.slice(0, 10)}… ${String(e).slice(0, 120)}`);
    }
  }
  return rows.length;
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

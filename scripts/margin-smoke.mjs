// DeepBook MARGIN trading — end-to-end smoke test on Sui TESTNET.
//
// Mode 1 (default, no key): read checks + ONE devInspect that executes the
//   entire margin flow atomically against live chain state:
//     pyth refresh → margin_manager::new_with_initializer → deposit 2 SUI
//     → borrow 0.5 DBUSDC → pool_proxy::place_limit_order_v2 (leveraged bid)
//     → share manager
//   Success proves creation, oracle freshness handling, collateral, borrowing,
//   risk-ratio gating and proxy order placement all work as the app sends them.
//
// Mode 2: SPOT_KEY=suiprivkey1... node scripts/margin-smoke.mjs --execute
//   Real run: ensure manager → deposit 1.5 SUI → borrow 0.3 DBUSDC → far bid
//   → snapshot (risk ratio) → cancel all → repay all → withdraw collateral.

import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import {
  DeepBookClient,
  testnetPackageIds,
  testnetPools,
  testnetCoins,
  testnetMarginPools,
} from "@mysten/deepbook-v3";

const RPC = "https://fullnode.testnet.sui.io:443";
const POOL_KEY = "SUI_DBUSDC";
const POOL = testnetPools[POOL_KEY];
const BASE = testnetCoins[POOL.baseCoin];
const QUOTE = testnetCoins[POOL.quoteCoin];
const MPKG = testnetPackageIds.MARGIN_PACKAGE_ID;
const MREG = testnetPackageIds.MARGIN_REGISTRY_ID;
const BASE_MP = testnetMarginPools[POOL.baseCoin].address;
const QUOTE_MP = testnetMarginPools[POOL.quoteCoin].address;
const FLOAT_SCALAR = 1_000_000_000;
const MAX_TS = 1_844_674_407_370_955_161n;
const DEV_SENDER =
  "0xd3e835d573c126bb7f5266f3d5390cdf0eba7bf05984316cfb0675f4be362b91";

const client = new SuiJsonRpcClient({ url: RPC, network: "testnet" });
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  console.error(`  ✗ ${m}`);
  process.exitCode = 1;
};

const makeDb = (address, managerId) =>
  new DeepBookClient({
    client,
    network: "testnet",
    address,
    marginManagers: managerId
      ? { M: { address: managerId, poolKey: POOL_KEY } }
      : {},
  });

const toRawPrice = (px) =>
  BigInt(Math.round((px * FLOAT_SCALAR * QUOTE.scalar) / BASE.scalar));
const dp = (s) => Math.max(0, Math.round(-Math.log10(s)));

async function main() {
  const execute = process.argv.includes("--execute");
  const db = makeDb(DEV_SENDER);

  console.log("\n— Reads (live testnet) —");
  for (const pk of ["SUI_DBUSDC", "DEEP_DBUSDC", "DBTC_DBUSDC", "DEEP_SUI"]) {
    const enabled = await db.isPoolEnabledForMargin(pk).catch(() => false);
    console.log(`  ${enabled ? "✓" : "·"} ${pk} margin-enabled=${enabled}`);
  }
  const [minBorrow, liq] = await Promise.all([
    db.getMinBorrowRiskRatio(POOL_KEY),
    db.getLiquidationRiskRatio(POOL_KEY),
  ]);
  ok(`risk params: minBorrow=${minBorrow} liquidation=${liq}`);
  const mid = await db.midPrice(POOL_KEY);
  ok(`midPrice=${mid}`);
  const params = await db.poolBookParams(POOL_KEY);
  const ids = await db.getMarginManagerIdsForOwner(DEV_SENDER).catch(() => []);
  ok(`getMarginManagerIdsForOwner(dev) -> ${ids.length}`);

  console.log("\n— Simulation: full margin flow in ONE PTB (devInspect) —");
  {
    const tx = new Transaction();
    tx.setSender(DEV_SENDER);

    // 1. fresh oracle prices in the same tx (testnet feeds are stale)
    await db.getPriceInfoObjects(tx, [POOL.baseCoin, POOL.quoteCoin]);

    // 2. create manager (hot-potato initializer so we can use it pre-share)
    const { manager, initializer } = tx.add(
      db.marginManager.newMarginManagerWithInitializer(POOL_KEY)
    );

    // 3. deposit 2 SUI collateral (coinWithBalance splits from virtual gas)
    db.marginManager.depositDuringInitialization({
      manager,
      poolKey: POOL_KEY,
      coinType: POOL.baseCoin,
      amount: 2,
    })(tx);

    // 4. borrow 1.5 DBUSDC against it (raw call — manager is in-PTB).
    //    Sized so the reduce-only leg's proceeds fit inside the debt.
    tx.moveCall({
      target: `${MPKG}::margin_manager::borrow_quote`,
      arguments: [
        manager,
        tx.object(MREG),
        tx.object(QUOTE_MP),
        tx.object(BASE.priceInfoObjectId),
        tx.object(QUOTE.priceInfoObjectId),
        tx.object(POOL.address),
        tx.pure.u64(BigInt(Math.round(1.5 * QUOTE.scalar))),
        tx.object.clock(),
      ],
      typeArguments: [BASE.type, QUOTE.type],
    });

    // 5. open the leveraged long: crossing bid buys minSize base with the
    //    borrowed quote (pool_proxy v1 — TESTNET signature, ABI-verified)
    const bidPx = Number(
      (Math.ceil((mid * 1.1) / params.tickSize) * params.tickSize).toFixed(
        dp(params.tickSize)
      )
    );
    tx.moveCall({
      target: `${MPKG}::pool_proxy::place_limit_order`,
      arguments: [
        tx.object(MREG),
        manager,
        tx.object(POOL.address),
        tx.pure.u64(1n),
        tx.pure.u8(0), // NO_RESTRICTION
        tx.pure.u8(0), // SELF_MATCHING_ALLOWED
        tx.pure.u64(toRawPrice(bidPx)),
        tx.pure.u64(BigInt(Math.round(params.minSize * BASE.scalar))),
        tx.pure.bool(true), // bid — crosses the book, position opens
        tx.pure.bool(false), // pay fees in input token
        tx.pure.u64(MAX_TS),
        tx.object.clock(),
      ],
      typeArguments: [BASE.type, QUOTE.type],
    });

    // 5b. reduce-only ask: now quote_debt > quote_asset (the borrow was
    //     spent), and the order's qty×limit-price fits inside the shortfall
    const roPx = Number(
      (Math.floor((mid * 0.95) / params.tickSize) * params.tickSize).toFixed(dp(params.tickSize))
    );
    tx.moveCall({
      target: `${MPKG}::pool_proxy::place_reduce_only_limit_order`,
      arguments: [
        tx.object(MREG),
        manager,
        tx.object(POOL.address),
        tx.object(QUOTE_MP), // debt-side margin pool
        tx.pure.u64(3n),
        tx.pure.u8(0),
        tx.pure.u8(0),
        tx.pure.u64(toRawPrice(roPx)),
        tx.pure.u64(BigInt(Math.round(params.minSize * BASE.scalar))),
        tx.pure.bool(false), // sell base → reduces quote debt
        tx.pure.bool(false),
        tx.pure.u64(MAX_TS),
        tx.object.clock(),
      ],
      typeArguments: [BASE.type, QUOTE.type, QUOTE.type],
    });

    // 6. arm a take-profit: trigger above 2× mid → market sell (TPSL leg)
    const tpTrigger = Number((Math.ceil((mid * 2) / params.tickSize) * params.tickSize).toFixed(dp(params.tickSize)));
    const cond = tx.moveCall({
      target: `${MPKG}::tpsl::new_condition`,
      arguments: [tx.pure.bool(false), tx.pure.u64(toRawPrice(tpTrigger))],
    });
    const pending = tx.moveCall({
      target: `${MPKG}::tpsl::new_pending_market_order`,
      arguments: [
        tx.pure.u64(2n),
        tx.pure.u8(0),
        tx.pure.u64(BigInt(Math.round(params.minSize * BASE.scalar))),
        tx.pure.bool(false), // sell
        tx.pure.bool(false), // input-token fees
      ],
    });
    tx.moveCall({
      target: `${MPKG}::margin_manager::add_conditional_order`,
      arguments: [
        manager,
        tx.object(POOL.address),
        tx.object(BASE.priceInfoObjectId),
        tx.object(QUOTE.priceInfoObjectId),
        tx.object(MREG),
        tx.pure.u64(7n),
        cond,
        pending,
        tx.object.clock(),
      ],
      typeArguments: [BASE.type, QUOTE.type],
    });
    // read back: ids + the full ConditionalOrder (validates the app's BCS parser)
    tx.moveCall({
      target: `${MPKG}::margin_manager::conditional_order_ids`,
      arguments: [manager],
      typeArguments: [BASE.type, QUOTE.type],
    });
    tx.moveCall({
      target: `${MPKG}::margin_manager::conditional_order`,
      arguments: [manager, tx.pure.u64(7n)],
      typeArguments: [BASE.type, QUOTE.type],
    });

    // 7. share
    tx.add(db.marginManager.shareMarginManager(POOL_KEY, manager, initializer));

    const res = await client.devInspectTransactionBlock({
      sender: DEV_SENDER,
      transactionBlock: tx,
    });
    const status = res.effects?.status;
    if (status?.status === "success") {
      ok(
        `create→deposit 2 SUI→borrow 1.5 DBUSDC→market-buy ${params.minSize}@≤${bidPx}→reduce-only ask@${roPx}→TP@${tpTrigger}→share — devInspect SUCCESS`
      );
      // parse the TPSL read-backs (last two results before share)
      const { bcs } = await import("@mysten/sui/bcs");
      const r = res.results;
      const idsBytes = r[r.length - 3].returnValues[0][0];
      const ids = bcs.vector(bcs.u64()).parse(Uint8Array.from(idsBytes));
      const CondOrder = bcs.struct("ConditionalOrder", {
        conditional_order_id: bcs.u64(),
        condition: bcs.struct("Condition", {
          trigger_below_price: bcs.bool(),
          trigger_price: bcs.u64(),
        }),
        pending_order: bcs.struct("PendingOrder", {
          is_limit_order: bcs.bool(),
          client_order_id: bcs.u64(),
          order_type: bcs.option(bcs.u8()),
          self_matching_option: bcs.u8(),
          price: bcs.option(bcs.u64()),
          quantity: bcs.u64(),
          is_bid: bcs.bool(),
          pay_with_deep: bcs.bool(),
          expire_timestamp: bcs.option(bcs.u64()),
        }),
      });
      const co = CondOrder.parse(
        Uint8Array.from(r[r.length - 2].returnValues[0][0])
      );
      const trig =
        (Number(co.condition.trigger_price) * BASE.scalar) /
        (FLOAT_SCALAR * QUOTE.scalar);
      if (ids.length === 1 && ids[0] === "7" && !co.condition.trigger_below_price)
        ok(
          `TPSL read-back parses: id=${co.conditional_order_id} trigger>${trig} marketSell qty=${Number(co.pending_order.quantity) / BASE.scalar}`
        );
      else fail(`TPSL parse mismatch: ids=${JSON.stringify(ids)}`);
    } else fail(`margin flow — ${status?.error ?? "unknown failure"}`);
  }

  console.log("\n— Simulation: earn (supply→withdraw) round-trip —");
  {
    const tx = new Transaction();
    tx.setSender(DEV_SENDER);
    const cap = tx.add(db.marginPool.mintSupplierCap());
    tx.add(db.marginPool.supplyToMarginPool("SUI", cap, 1));
    const coinOut = tx.add(db.marginPool.withdrawFromMarginPool("SUI", cap));
    tx.transferObjects([coinOut, cap], DEV_SENDER);
    const res = await client.devInspectTransactionBlock({
      sender: DEV_SENDER,
      transactionBlock: tx,
    });
    if (res.effects?.status?.status === "success")
      ok("mint SupplierCap→supply 1 SUI→withdraw all — devInspect SUCCESS");
    else fail(`earn flow — ${res.effects?.status?.error}`);
  }

  console.log("\n— Simulation: position snapshot reads (existing manager) —");
  try {
    // any live manager on this pool will do — reads need no ownership
    const infos = await (
      await fetch(
        "https://deepbook-indexer.testnet.mystenlabs.com/margin_managers_info"
      )
    ).json();
    const target = infos.find((m) => m.deepbook_pool_id === POOL.address);
    if (!target) {
      console.log("  · no existing manager on this pool to read — skipped");
    } else {
      const mid2 = target.margin_manager_id;
      const tx = new Transaction();
      tx.setSender(DEV_SENDER);
      await db.getPriceInfoObjects(tx, [POOL.baseCoin, POOL.quoteCoin]);
      tx.add(db.marginManager.managerState(POOL_KEY, mid2));
      tx.add(db.marginManager.baseBalance(POOL_KEY, mid2));
      tx.add(db.marginManager.quoteBalance(POOL_KEY, mid2));
      tx.add(db.marginManager.deepBalance(POOL_KEY, mid2));
      tx.add(db.marginTPSL.conditionalOrderIds(POOL_KEY, mid2));
      // chain &BalanceManager into deepbook pool reads (testnet path)
      const bmRef = tx.moveCall({
        target: `${MPKG}::margin_manager::balance_manager`,
        arguments: [tx.object(mid2)],
        typeArguments: [BASE.type, QUOTE.type],
      });
      tx.moveCall({
        target: `${testnetPackageIds.DEEPBOOK_PACKAGE_ID}::pool::get_account_order_details`,
        arguments: [tx.object(POOL.address), bmRef],
        typeArguments: [BASE.type, QUOTE.type],
      });
      tx.moveCall({
        target: `${testnetPackageIds.DEEPBOOK_PACKAGE_ID}::pool::account`,
        arguments: [tx.object(POOL.address), bmRef],
        typeArguments: [BASE.type, QUOTE.type],
      });
      const res = await client.devInspectTransactionBlock({
        sender: DEV_SENDER,
        transactionBlock: tx,
      });
      if (res.effects?.status?.status !== "success")
        fail(`snapshot reads — ${res.effects?.status?.error}`);
      else {
        // mirrors the app: account -1, orders -2, bmRef -3, condIds -4,
        // deepBal -5, quoteBal -6, baseBal -7, managerState -8
        const r = res.results;
        const state = r[r.length - 8].returnValues;
        const { bcs } = await import("@mysten/sui/bcs");
        const rr =
          Number(bcs.U64.parse(Uint8Array.from(state[2][0]))) / FLOAT_SCALAR;
        const condIds = bcs
          .vector(bcs.u64())
          .parse(Uint8Array.from(r[r.length - 4].returnValues[0][0]));
        const ordersBytes = r[r.length - 2].returnValues[0][0];
        const { Order } = await import("@mysten/deepbook-v3");
        const orders = bcs.vector(Order).parse(Uint8Array.from(ordersBytes));
        ok(
          `snapshot of ${mid2.slice(0, 10)}… — riskRatio=${rr > 999 ? "∞" : rr.toFixed(3)}, openOrders=${orders.length}, tpsl=${condIds.length} (ref-chaining works)`
        );
      }
    }
  } catch (e) {
    fail(`snapshot reads — ${String(e).slice(0, 140)}`);
  }

  if (!execute) {
    console.log(
      "\nDry-run complete. For a REAL margin round-trip:\n  SPOT_KEY=suiprivkey1... node scripts/margin-smoke.mjs --execute\n"
    );
    return;
  }

  console.log("\n— Real execution —");
  const pk = process.env.SPOT_KEY;
  if (!pk) return fail("SPOT_KEY env var not set");
  const { schema, secretKey } = decodeSuiPrivateKey(pk);
  if (schema !== "ED25519") return fail(`unsupported key scheme ${schema}`);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const sender = keypair.toSuiAddress();
  console.log(`  signer: ${sender}`);

  const sign = async (tx, label) => {
    tx.setSenderIfNotSet(sender);
    const res = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true },
    });
    if (res.effects?.status?.status !== "success")
      throw new Error(`${label}: ${res.effects?.status?.error}`);
    await client.waitForTransaction({ digest: res.digest });
    ok(`${label} — ${res.digest}`);
    return res;
  };

  // 1. ensure manager for this pool
  let dbS = makeDb(sender);
  let managerId = null;
  const owned = await dbS.getMarginManagerIdsForOwner(sender).catch(() => []);
  if (owned.length) {
    const objs = await client.multiGetObjects({
      ids: owned,
      options: { showContent: true },
    });
    managerId = objs.find(
      (o) => o.data?.content?.fields?.deepbook_pool === POOL.address
    )?.data?.objectId;
  }
  if (!managerId) {
    const tx = new Transaction();
    tx.add(dbS.marginManager.newMarginManager(POOL_KEY));
    const res = await sign(tx, "create margin manager");
    managerId = res.objectChanges?.find(
      (c) =>
        c.type === "created" &&
        c.objectType?.includes("::margin_manager::MarginManager")
    )?.objectId;
  }
  console.log(`  manager: ${managerId}`);
  dbS = makeDb(sender, managerId);

  // 2. deposit + borrow + far bid (each needs fresh oracles)
  {
    const tx = new Transaction();
    tx.setSender(sender);
    await dbS.getPriceInfoObjects(tx, [POOL.baseCoin, POOL.quoteCoin]);
    tx.add(dbS.marginManager.depositBase({ managerKey: "M", amount: 1.5 }));
    tx.add(dbS.marginManager.borrowQuote("M", 0.3));
    // v1 proxy order (testnet has no *_v2)
    const bidPx = Number(
      (Math.floor((mid * 0.5) / params.tickSize) * params.tickSize).toFixed(
        dp(params.tickSize)
      )
    );
    tx.moveCall({
      target: `${MPKG}::pool_proxy::place_limit_order`,
      arguments: [
        tx.object(MREG),
        tx.object(managerId),
        tx.object(POOL.address),
        tx.pure.u64(BigInt(Date.now())),
        tx.pure.u8(0),
        tx.pure.u8(0),
        tx.pure.u64(toRawPrice(bidPx)),
        tx.pure.u64(BigInt(Math.round(params.minSize * BASE.scalar))),
        tx.pure.bool(true),
        tx.pure.bool(false),
        tx.pure.u64(MAX_TS),
        tx.object.clock(),
      ],
      typeArguments: [BASE.type, QUOTE.type],
    });
    await sign(tx, "deposit 1.5 SUI + borrow 0.3 DBUSDC + leveraged bid");
  }

  // 3. snapshot
  const state = await dbS.getMarginManagerState("M").catch((e) => {
    console.log(`  (managerState read skipped: ${String(e).slice(0, 80)})`);
    return null;
  });
  if (state) ok(`risk ratio=${state.riskRatio} debt=${state.quoteDebt} ${POOL.quoteCoin}`);

  // 4. unwind: cancel, repay, withdraw
  {
    const tx = new Transaction();
    tx.add(dbS.poolProxy.cancelAllOrders("M"));
    tx.add(dbS.poolProxy.withdrawSettledAmounts("M"));
    tx.add(dbS.marginManager.repayQuote("M")); // repay all
    await sign(tx, "cancel all + repay loan");
  }
  {
    const tx = new Transaction();
    tx.setSender(sender);
    await dbS.getPriceInfoObjects(tx, [POOL.baseCoin, POOL.quoteCoin]);
    const coin = tx.add(dbS.marginManager.withdrawBase("M", 1.49));
    tx.transferObjects([coin], sender);
    await sign(tx, "withdraw collateral");
  }

  console.log("\nEnd-to-end MARGIN flow verified on testnet ✓\n");
}

main().catch((e) => {
  fail(e?.message ?? String(e));
  process.exit(1);
});

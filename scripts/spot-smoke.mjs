// DeepBook V3 spot trading — end-to-end smoke test on Sui TESTNET.
//
// Mode 1 (default, no key needed): read checks + a full devInspect of the
//   exact PTBs the app sends:
//     a) create + register + share a BalanceManager
//     b) create manager → deposit SUI → place a limit ask on SUI_DBUSDC
//        (single PTB, raw move calls mirroring the SDK's encoding)
//   devInspect executes the real Move logic against live on-chain state, so
//   success here proves the signed path works.
//
// Mode 2 (real execution): SPOT_KEY=suiprivkey1... node scripts/spot-smoke.mjs --execute
//   Creates (or reuses) a manager, deposits 0.2 SUI, places a far-from-mid
//   ask, reads open orders, cancels it, withdraws all SUI back. Leaves the
//   account exactly as funded before, minus gas.
//
// Usage:
//   node scripts/spot-smoke.mjs
//   SPOT_KEY=suiprivkey1... node scripts/spot-smoke.mjs --execute

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
const PKG = testnetPackageIds.DEEPBOOK_PACKAGE_ID;
const REGISTRY = testnetPackageIds.REGISTRY_ID;
const POOL_KEY = "SUI_DBUSDC";
const POOL = testnetPools[POOL_KEY];
const BASE = testnetCoins[POOL.baseCoin]; // SUI (scalar 1e9)
const QUOTE = testnetCoins[POOL.quoteCoin]; // DBUSDC (scalar 1e6)
const FLOAT_SCALAR = 1_000_000_000;
// any funded-ish address works as devInspect sender (gas is virtual)
const DEV_SENDER =
  "0xd3e835d573c126bb7f5266f3d5390cdf0eba7bf05984316cfb0675f4be362b91";

const client = new SuiJsonRpcClient({ url: RPC, network: "testnet" });
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  console.error(`  ✗ ${m}`);
  process.exitCode = 1;
};

const toRawPrice = (px) =>
  BigInt(Math.round((px * FLOAT_SCALAR * QUOTE.scalar) / BASE.scalar));
const toRawQty = (q) => BigInt(Math.round(q * BASE.scalar));

function buildManagerOnly() {
  const tx = new Transaction();
  const manager = tx.moveCall({ target: `${PKG}::balance_manager::new` });
  tx.moveCall({
    target: `${PKG}::balance_manager::register_balance_manager`,
    arguments: [manager, tx.object(REGISTRY)],
  });
  tx.moveCall({
    target: "0x2::transfer::public_share_object",
    arguments: [manager],
    typeArguments: [`${PKG}::balance_manager::BalanceManager`],
  });
  return tx;
}

/** create manager → deposit SUI → proof → place limit ask → share. One PTB. */
function buildFullTradeFlow(priceHuman, qtyHuman, depositSui) {
  const tx = new Transaction();
  const manager = tx.moveCall({ target: `${PKG}::balance_manager::new` });
  tx.moveCall({
    target: `${PKG}::balance_manager::register_balance_manager`,
    arguments: [manager, tx.object(REGISTRY)],
  });
  const [depositCoin] = tx.splitCoins(tx.gas, [
    BigInt(Math.round(depositSui * BASE.scalar)),
  ]);
  tx.moveCall({
    target: `${PKG}::balance_manager::deposit`,
    arguments: [manager, depositCoin],
    typeArguments: [BASE.type],
  });
  const proof = tx.moveCall({
    target: `${PKG}::balance_manager::generate_proof_as_owner`,
    arguments: [manager],
  });
  tx.moveCall({
    target: `${PKG}::pool::place_limit_order`,
    arguments: [
      tx.object(POOL.address),
      manager,
      proof,
      tx.pure.u64(1n), // client order id
      tx.pure.u8(0), // NO_RESTRICTION
      tx.pure.u8(0), // SELF_MATCHING_ALLOWED
      tx.pure.u64(toRawPrice(priceHuman)),
      tx.pure.u64(toRawQty(qtyHuman)),
      tx.pure.bool(false), // is_bid = false (ask)
      tx.pure.bool(false), // pay_with_deep = false → input-token fees
      tx.pure.u64(1_844_674_407_370_955_161n), // MAX_TIMESTAMP
      tx.object.clock(),
    ],
    typeArguments: [BASE.type, QUOTE.type],
  });
  tx.moveCall({
    target: "0x2::transfer::public_share_object",
    arguments: [manager],
    typeArguments: [`${PKG}::balance_manager::BalanceManager`],
  });
  return tx;
}

async function devInspect(tx, sender, label) {
  tx.setSenderIfNotSet(sender);
  const res = await client.devInspectTransactionBlock({
    sender,
    transactionBlock: tx,
  });
  const status = res.effects?.status;
  if (status?.status === "success") ok(`${label} — devInspect SUCCESS`);
  else fail(`${label} — ${status?.error ?? "unknown failure"}`);
  return status?.status === "success";
}

async function main() {
  const execute = process.argv.includes("--execute");

  console.log("\n— Reads (SDK, live testnet state) —");
  const db = new DeepBookClient({
    client,
    network: "testnet",
    address: DEV_SENDER,
  });

  const mid = await db.midPrice(POOL_KEY);
  if (mid > 0) ok(`midPrice(${POOL_KEY}) = ${mid}`);
  else fail("midPrice returned 0");

  const params = await db.poolBookParams(POOL_KEY);
  ok(
    `poolBookParams: tick=${params.tickSize} lot=${params.lotSize} min=${params.minSize}`
  );
  const wl = await db.whitelisted(POOL_KEY);
  const wlDeepSui = await db.whitelisted("DEEP_SUI");
  ok(`whitelisted: ${POOL_KEY}=${wl}, DEEP_SUI=${wlDeepSui}`);

  const ids = await db.getBalanceManagerIds(DEV_SENDER);
  ok(`getBalanceManagerIds(dev) -> ${ids.length} registered manager(s)`);

  const book = await db.getLevel2TicksFromMid(POOL_KEY, 3);
  ok(
    `level2: bestBid=${book.bid_prices[0] ?? "—"} bestAsk=${book.ask_prices[0] ?? "—"}`
  );

  console.log("\n— Simulations (exact app PTBs, devInspect) —");
  await devInspect(buildManagerOnly(), DEV_SENDER, "create+register+share manager");

  // far-above-mid ask so the sim never matches; aligned to tick/lot/min
  const dp = (s) => Math.max(0, Math.round(-Math.log10(s)));
  const rawAsk = mid * 1.5;
  const askPx = Number(
    (Math.ceil(rawAsk / params.tickSize) * params.tickSize).toFixed(dp(params.tickSize))
  );
  const qty = params.minSize;
  await devInspect(
    buildFullTradeFlow(askPx, qty, qty * 1.05),
    DEV_SENDER,
    `create→deposit ${qty * 1.05} SUI→place ask ${qty}@${askPx} (input-token fees)`
  );

  if (!execute) {
    console.log(
      "\nDry-run complete. To place/cancel a REAL order:\n  SPOT_KEY=suiprivkey1... node scripts/spot-smoke.mjs --execute\n"
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

  // 1. ensure manager
  let managerId = (await db.getBalanceManagerIds(sender))[0];
  if (!managerId) {
    const res = await sign(buildManagerOnly(), "create manager");
    managerId = res.objectChanges?.find(
      (c) => c.type === "created" && c.objectType?.includes("::balance_manager::BalanceManager")
    )?.objectId;
  }
  console.log(`  manager: ${managerId}`);

  const dbm = new DeepBookClient({
    client,
    network: "testnet",
    address: sender,
    balanceManagers: { M: { address: managerId } },
  });

  // 2. deposit + place far ask in one PTB (the app's auto-top-up path)
  const dp2 = (s) => Math.max(0, Math.round(-Math.log10(s)));
  const askPx2 = Number(
    (Math.ceil((mid * 1.5) / params.tickSize) * params.tickSize).toFixed(dp2(params.tickSize))
  );
  const tx2 = new Transaction();
  tx2.add(dbm.balanceManager.depositIntoManager("M", "SUI", params.minSize * 1.05));
  tx2.add(
    dbm.deepBook.placeLimitOrder({
      poolKey: POOL_KEY,
      balanceManagerKey: "M",
      clientOrderId: Date.now().toString(),
      price: askPx2,
      quantity: params.minSize,
      isBid: false,
      payWithDeep: false,
    })
  );
  await sign(tx2, `deposit+place ask ${params.minSize}@${askPx2}`);

  // 3. read open orders
  const orders = await dbm.getAccountOrderDetails(POOL_KEY, "M");
  ok(`open orders: ${orders.length}`);

  // 4. cancel all + withdraw everything back
  const tx3 = new Transaction();
  tx3.add(dbm.deepBook.cancelAllOrders(POOL_KEY, "M"));
  tx3.add(dbm.balanceManager.withdrawAllFromManager("M", "SUI", sender));
  await sign(tx3, "cancel all + withdraw all SUI");

  console.log("\nEnd-to-end spot flow verified on testnet ✓\n");
}

main().catch((e) => {
  fail(e?.message ?? String(e));
  process.exit(1);
});

// Execute ONE real three-protocol Combo PTB on Sui testnet and print the digest.
//
// Spans DeepBook Margin (SUI collateral) + DeepBook Predict (range) + PLP (opt.),
// with a Pyth price refresh prepended so the margin deposit passes the freshness
// check. Dry-runs (devInspect) first; only signs if the simulation succeeds.
//
// SAFETY: your key is read from the COMBO_KEY env var on THIS machine and never
// leaves it. Do not paste your key into any chat.
//
// Usage:
//   COMBO_KEY=suiprivkey1...            # funded testnet wallet (SUI + dUSDC)
//   COMBO_SUI_COLLATERAL=0.5           # optional, SUI (default 0.5)
//   COMBO_PREDICT_DUSDC=2              # optional, dUSDC into the range (default 2)
//   COMBO_PLP_DUSDC=0                 # optional, dUSDC into PLP (default 0 = skip)
//   node scripts/combo-execute.mjs

import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { bcs } from "@mysten/sui/bcs";

// ── config ──────────────────────────────────────────────────────────────────
const RPC = "https://fullnode.testnet.sui.io:443";
const INDEXER = "https://predict-server.testnet.mystenlabs.com";
const HERMES = "https://hermes-beta.pyth.network";

const SUI_COLLATERAL = Number(process.env.COMBO_SUI_COLLATERAL ?? "0.5");
const PREDICT_DUSDC = Number(process.env.COMBO_PREDICT_DUSDC ?? "2");
const PLP_DUSDC = Number(process.env.COMBO_PLP_DUSDC ?? "0");

// ── constants (testnet, verified earlier) ────────────────────────────────────
const PREDICT_PKG = "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138";
const DUSDC_PKG = "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a";
const PREDICT_OBJ = "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a";
const CLOCK = "0x6";
const DUSDC = `${DUSDC_PKG}::dusdc::DUSDC`;
const SUI = "0x2::sui::SUI";
const DBUSDC = "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC";

const T = {
  createManager: `${PREDICT_PKG}::predict::create_manager`,
  managerDeposit: `${PREDICT_PKG}::predict_manager::deposit`,
  mintRange: `${PREDICT_PKG}::predict::mint_range`,
  rangeKeyNew: `${PREDICT_PKG}::range_key::new`,
  getRangeTradeAmounts: `${PREDICT_PKG}::predict::get_range_trade_amounts`,
  supply: `${PREDICT_PKG}::predict::supply`,
};

const MARGIN_PKG = "0xd6a42f4df4db73d68cbeb52be66698d2fe6a9464f45ad113ca52b0c6ebd918b6";
const SUI_DBUSDC_POOL = "0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5";
const DEEPBOOK_REGISTRY = "0x7c256edbda983a2cd6f946655f4bf3f00a41043993781f8674a7046e8c0e11d1";
const MARGIN_REGISTRY = "0x48d7640dfae2c6e9ceeada197a7a1643984b5a24c55a0c6c023dac77e0339f75";
const SUI_PRICE_INFO = "0x1ebb295c789cc42b3b2a1606482cd1c7124076a0f5676718501fda8c7fd075a0";
const DBUSDC_PRICE_INFO = "0x9c4dd4008297ffa5e480684b8100ec21cc934405ed9a25d4e4d7b6259aad9c81";

const PYTH_PKG = "0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837";
const PYTH_STATE = "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c";
const WH_PKG = "0x21473617f3565d704aa67be73ea41243e9e34a42d434c31f8182c67ba01ccf49";
const WH_STATE = "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790";
const BASE_FEE = 1;
const SUI_FEED = "50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266";
const DBUSDC_FEED = "41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722";

const PRICE_SCALE = 1e9, DUSDC_SCALE = 1e6, Q0 = 1_000_000;
const toDusdc = a => BigInt(Math.round(a * DUSDC_SCALE)).toString();
const fromPrice = r => Number(r) / PRICE_SCALE;

const client = new SuiJsonRpcClient({ url: RPC });
const log = (...a) => console.log(...a);

// ── helpers ───────────────────────────────────────────────────────────────
async function api(path) {
  const r = await fetch(`${INDEXER}${path}`);
  if (!r.ok) throw new Error(`indexer ${r.status} ${path}`);
  return r.json();
}

function extractVaa(msg) {
  const dv = new DataView(msg.buffer, msg.byteOffset, msg.byteLength);
  const tps = dv.getUint8(6);
  const off = 7 + tps + 1;
  const sz = dv.getUint16(off, false);
  return msg.subarray(off + 2, off + 2 + sz);
}

function addPythUpdate(tx, accMsg) {
  const vaa = extractVaa(accMsg);
  const [verified] = tx.moveCall({
    target: `${WH_PKG}::vaa::parse_and_verify`,
    arguments: [tx.object(WH_STATE), tx.pure.vector("u8", Array.from(vaa)), tx.object(CLOCK)],
  });
  let [hp] = tx.moveCall({
    target: `${PYTH_PKG}::pyth::create_authenticated_price_infos_using_accumulator`,
    arguments: [tx.object(PYTH_STATE), tx.pure.vector("u8", Array.from(accMsg)), verified, tx.object(CLOCK)],
  });
  const fees = tx.splitCoins(tx.gas, [tx.pure.u64(BASE_FEE), tx.pure.u64(BASE_FEE)]);
  for (const [pio, fee] of [[SUI_PRICE_INFO, fees[0]], [DBUSDC_PRICE_INFO, fees[1]]]) {
    [hp] = tx.moveCall({
      target: `${PYTH_PKG}::pyth::update_single_price_feed`,
      arguments: [tx.object(PYTH_STATE), hp, tx.object(pio), fee, tx.object(CLOCK)],
    });
  }
  tx.moveCall({
    target: `${PYTH_PKG}::hot_potato_vector::destroy`,
    typeArguments: [`${PYTH_PKG}::price_info::PriceInfo`],
    arguments: [hp],
  });
}

// ── main ────────────────────────────────────────────────────────────────────
const keyStr = process.env.COMBO_KEY;
if (!keyStr) {
  log("✗ Set COMBO_KEY (suiprivkey1…) in your env. Your key is read locally and never shared.");
  process.exit(1);
}
const kp = Ed25519Keypair.fromSecretKey(keyStr.trim());
const owner = kp.toSuiAddress();
log(`▸ wallet: ${owner}`);

// balances
const suiBal = await client.getBalance({ owner });
const dusdcBal = await client.getBalance({ owner, coinType: DUSDC });
log(`  SUI:   ${(Number(suiBal.totalBalance) / 1e9).toFixed(4)}`);
log(`  dUSDC: ${(Number(dusdcBal.totalBalance) / 1e6).toFixed(4)}`);
const needDusdc = PREDICT_DUSDC + PLP_DUSDC;
if (Number(dusdcBal.totalBalance) < Number(toDusdc(needDusdc))) {
  log(`✗ Need ${needDusdc} dUSDC. Get testnet dUSDC: https://tally.so/r/Xx102L`);
  process.exit(1);
}
if (Number(suiBal.totalBalance) < Number(toDusdc(0)) + SUI_COLLATERAL * 1e9 + 5e7) {
  log(`✗ Need ~${(SUI_COLLATERAL + 0.05).toFixed(2)} SUI (collateral + gas). Use the SUI faucet.`);
  process.exit(1);
}

// ensure manager
log("▸ ensuring PredictManager…");
const mgrs = await api(`/managers`).catch(() => []);
let managerId = (Array.isArray(mgrs) ? mgrs : [])
  .filter(m => m.owner === owner)
  .sort((a, b) => b.checkpoint_timestamp_ms - a.checkpoint_timestamp_ms)[0]?.manager_id;
if (!managerId) {
  const tx = new Transaction();
  tx.setSender(owner);
  tx.moveCall({ target: T.createManager });
  const r = await client.signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showObjectChanges: true } });
  await client.waitForTransaction({ digest: r.digest });
  const full = await client.getTransactionBlock({ digest: r.digest, options: { showObjectChanges: true } });
  managerId = full.objectChanges.find(c => c.type === "created" && c.objectType?.includes("::predict_manager::PredictManager"))?.objectId;
  log(`  created manager ${managerId}`);
} else log(`  using manager ${managerId}`);

// pick oracle + range
const oracles = (await api(`/predicts/${PREDICT_OBJ}/oracles`)).filter(o => o.status === "active");
const oracle = oracles.find(o => o.underlying_asset === "BTC") ?? oracles[0];
if (!oracle) { log("✗ no active oracle"); process.exit(1); }
const priceRes = await api(`/oracles/${oracle.oracle_id}/prices/latest`).catch(() => null);
const priceRow = Array.isArray(priceRes) ? priceRes[0] : priceRes;
// Live /prices/latest rows carry {spot, forward} (1e9 raw) — there is no `price` field.
const fwdRaw = priceRow?.forward ?? priceRow?.spot;
const fwd = fwdRaw ? fromPrice(fwdRaw) : fromPrice(oracle.min_strike) * 1.4;
const band = fwd * 0.01;
// Strikes must sit on the oracle grid: min_strike + k·tick_size (1e9 raw).
// tick is currently $1 on testnet, but snap explicitly instead of relying on it.
const snapToGrid = usd => {
  const min = Number(oracle.min_strike), tick = Number(oracle.tick_size);
  const k = Math.max(0, Math.round((usd * PRICE_SCALE - min) / tick));
  return min + k * tick; // raw 1e9, exactly on the grid
};
const lowerRaw = snapToGrid(fwd - band);
const higherRaw = Math.max(snapToGrid(fwd + band), lowerRaw + Number(oracle.tick_size));
const lowerUsd = lowerRaw / PRICE_SCALE, higherUsd = higherRaw / PRICE_SCALE;
log(`▸ oracle ${oracle.oracle_id.slice(0, 10)}…  fwd ~$${Math.round(fwd).toLocaleString()}  range $${lowerUsd}–$${higherUsd}  expiry +${Math.round((oracle.expiry - Date.now()) / 60000)}m`);

// size range qty via devInspect
const sizeTx = new Transaction();
const sKey = sizeTx.moveCall({ target: T.rangeKeyNew, arguments: [sizeTx.pure.id(oracle.oracle_id), sizeTx.pure.u64(oracle.expiry), sizeTx.pure.u64(String(lowerRaw)), sizeTx.pure.u64(String(higherRaw))] });
sizeTx.moveCall({ target: T.getRangeTradeAmounts, arguments: [sizeTx.object(PREDICT_OBJ), sizeTx.object(oracle.oracle_id), sKey, sizeTx.pure.u64(Q0), sizeTx.object(CLOCK)] });
const sizeRes = await client.devInspectTransactionBlock({ sender: owner, transactionBlock: sizeTx });
const rv = sizeRes.results?.at(-1)?.returnValues;
if (!rv?.length) { log("✗ could not price range:", sizeRes.effects?.status?.error); process.exit(1); }
const askCost = Number(bcs.U64.parse(Uint8Array.from(rv[0][0])));
const quantity = String(Math.floor((Number(toDusdc(PREDICT_DUSDC)) * Q0) / askCost));
log(`  sized quantity: ${quantity} (askCost/${Q0}=${askCost})`);

// fetch pyth update
log("▸ fetching Pyth update from hermes-beta…");
const hermes = await (await fetch(`${HERMES}/v2/updates/price/latest?ids[]=${SUI_FEED}&ids[]=${DBUSDC_FEED}&encoding=base64`)).json();
const accMsg = Uint8Array.from(Buffer.from(hermes.binary.data[0], "base64"));

// dUSDC coins
const { data: coins } = await client.getCoins({ owner, coinType: DUSDC });

function build() {
  const tx = new Transaction();
  tx.setSender(owner);

  // Leg 0: Pyth refresh
  addPythUpdate(tx, accMsg);

  // Leg 1: Margin — collateral, new, deposit, share
  const [collateral] = tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(Math.round(SUI_COLLATERAL * 1e9)).toString())]);
  const mgr = tx.moveCall({ target: `${MARGIN_PKG}::margin_manager::new_with_initializer`, typeArguments: [SUI, DBUSDC], arguments: [tx.object(SUI_DBUSDC_POOL), tx.object(DEEPBOOK_REGISTRY), tx.object(MARGIN_REGISTRY), tx.object(CLOCK)] });
  tx.moveCall({ target: `${MARGIN_PKG}::margin_manager::deposit`, typeArguments: [SUI, DBUSDC, SUI], arguments: [mgr[0], tx.object(MARGIN_REGISTRY), tx.object(SUI_PRICE_INFO), tx.object(DBUSDC_PRICE_INFO), collateral, tx.object(CLOCK)] });
  tx.moveCall({ target: `${MARGIN_PKG}::margin_manager::share`, typeArguments: [SUI, DBUSDC], arguments: [mgr[0], mgr[1]] });

  // dUSDC source (merge if needed)
  const [primary, ...rest] = coins;
  const src = tx.object(primary.coinObjectId);
  if (rest.length) tx.mergeCoins(src, rest.map(c => tx.object(c.coinObjectId)));

  // Leg 2 (opt): PLP supply
  if (PLP_DUSDC > 0) {
    const [plpCoin] = tx.splitCoins(src, [tx.pure.u64(toDusdc(PLP_DUSDC))]);
    const plp = tx.moveCall({ target: T.supply, typeArguments: [DUSDC], arguments: [tx.object(PREDICT_OBJ), plpCoin, tx.object(CLOCK)] });
    tx.transferObjects([plp], tx.pure.address(owner));
  }

  // Leg 3: Predict range
  const [depositCoin] = tx.splitCoins(src, [tx.pure.u64(toDusdc(PREDICT_DUSDC))]);
  tx.moveCall({ target: T.managerDeposit, typeArguments: [DUSDC], arguments: [tx.object(managerId), depositCoin] });
  const rKey = tx.moveCall({ target: T.rangeKeyNew, arguments: [tx.pure.id(oracle.oracle_id), tx.pure.u64(oracle.expiry), tx.pure.u64(String(lowerRaw)), tx.pure.u64(String(higherRaw))] });
  tx.moveCall({ target: T.mintRange, typeArguments: [DUSDC], arguments: [tx.object(PREDICT_OBJ), tx.object(managerId), tx.object(oracle.oracle_id), rKey, tx.pure.u64(quantity), tx.object(CLOCK)] });

  return tx;
}

// dry-run
log("▸ simulating combo PTB (devInspect)…");
const sim = await client.devInspectTransactionBlock({ sender: owner, transactionBlock: build() });
if (sim.effects?.status?.status !== "success") {
  log("✗ simulation reverted:", sim.effects?.status?.error);
  process.exit(1);
}
log("  ✓ simulation passed");

// execute for real
log("▸ signing + executing on testnet…");
const res = await client.signAndExecuteTransaction({ signer: kp, transaction: build(), options: { showObjectChanges: true, showEffects: true } });
await client.waitForTransaction({ digest: res.digest });
const full = await client.getTransactionBlock({ digest: res.digest, options: { showObjectChanges: true, showEffects: true } });
const marginId = full.objectChanges?.find(c => c.type === "created" && c.objectType?.includes("::margin_manager::MarginManager"))?.objectId;

log("");
log("✅ COMBO PTB LANDED ON TESTNET");
log(`   status:  ${full.effects?.status?.status}`);
log(`   digest:  ${res.digest}`);
log(`   tx:      https://suiscan.xyz/testnet/tx/${res.digest}`);
if (marginId) log(`   margin:  https://suiscan.xyz/testnet/object/${marginId}`);
log(`   manager: https://suiscan.xyz/testnet/object/${managerId}`);

// Dry-run (devInspect) the margin legs WITH a real Pyth refresh prepended.
// No signature needed: devInspect executes the full PTB (Wormhole VAA verify +
// pyth update + margin new/deposit/share) and surfaces any abort.
// Success here proves the deposit now passes check_price_is_fresh.
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";

const RPC = "https://fullnode.testnet.sui.io:443";
const SENDER = "0x0000000000000000000000000000000000000000000000000000000000000abc";

const MARGIN_PKG = "0xd6a42f4df4db73d68cbeb52be66698d2fe6a9464f45ad113ca52b0c6ebd918b6";
const SUI_DBUSDC_POOL = "0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5";
const DEEPBOOK_REGISTRY = "0x7c256edbda983a2cd6f946655f4bf3f00a41043993781f8674a7046e8c0e11d1";
const MARGIN_REGISTRY = "0x48d7640dfae2c6e9ceeada197a7a1643984b5a24c55a0c6c023dac77e0339f75";
const SUI_PRICE_INFO = "0x1ebb295c789cc42b3b2a1606482cd1c7124076a0f5676718501fda8c7fd075a0";
const DBUSDC_PRICE_INFO = "0x9c4dd4008297ffa5e480684b8100ec21cc934405ed9a25d4e4d7b6259aad9c81";
const CLOCK = "0x6";

const SUI = "0x2::sui::SUI";
const DBUSDC = "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC";

// Pyth (testnet) — verified via ABI
const PYTH_PKG = "0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837";
const PYTH_STATE = "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c";
const WH_PKG = "0x21473617f3565d704aa67be73ea41243e9e34a42d434c31f8182c67ba01ccf49";
const WH_STATE = "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790";
const BASE_FEE = 1;
const SUI_FEED = "50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266";
const DBUSDC_FEED = "41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722";

const client = new SuiJsonRpcClient({ url: RPC });

// 1. Fetch the accumulator update from hermes-beta
const url = `https://hermes-beta.pyth.network/v2/updates/price/latest?ids[]=${SUI_FEED}&ids[]=${DBUSDC_FEED}&encoding=base64`;
const hermes = await (await fetch(url)).json();
const accMsg = Uint8Array.from(Buffer.from(hermes.binary.data[0], "base64"));
console.log("accumulator msg bytes:", accMsg.length);

function extractVaa(msg) {
  const dv = new DataView(msg.buffer, msg.byteOffset, msg.byteLength);
  const tps = dv.getUint8(6);
  const off = 7 + tps + 1;
  const sz = dv.getUint16(off, false);
  return msg.subarray(off + 2, off + 2 + sz);
}
const vaa = extractVaa(accMsg);
console.log("extracted VAA bytes:", vaa.length);

const tx = new Transaction();
tx.setSender(SENDER);

// ── Pyth refresh ──
const [verifiedVaa] = tx.moveCall({
  target: `${WH_PKG}::vaa::parse_and_verify`,
  arguments: [tx.object(WH_STATE), tx.pure.vector("u8", Array.from(vaa)), tx.object(CLOCK)],
});
let hp = tx.moveCall({
  target: `${PYTH_PKG}::pyth::create_authenticated_price_infos_using_accumulator`,
  arguments: [tx.object(PYTH_STATE), tx.pure.vector("u8", Array.from(accMsg)), verifiedVaa, tx.object(CLOCK)],
});
const fees = tx.splitCoins(tx.gas, [tx.pure.u64(BASE_FEE), tx.pure.u64(BASE_FEE)]);
[hp] = tx.moveCall({
  target: `${PYTH_PKG}::pyth::update_single_price_feed`,
  arguments: [tx.object(PYTH_STATE), hp, tx.object(SUI_PRICE_INFO), fees[0], tx.object(CLOCK)],
});
[hp] = tx.moveCall({
  target: `${PYTH_PKG}::pyth::update_single_price_feed`,
  arguments: [tx.object(PYTH_STATE), hp, tx.object(DBUSDC_PRICE_INFO), fees[1], tx.object(CLOCK)],
});
tx.moveCall({
  target: `${PYTH_PKG}::hot_potato_vector::destroy`,
  typeArguments: [`${PYTH_PKG}::price_info::PriceInfo`],
  arguments: [hp],
});

// ── Margin legs ──
const [collateral] = tx.splitCoins(tx.gas, [tx.pure.u64(10_000_000)]);
const mgr = tx.moveCall({
  target: `${MARGIN_PKG}::margin_manager::new_with_initializer`,
  typeArguments: [SUI, DBUSDC],
  arguments: [tx.object(SUI_DBUSDC_POOL), tx.object(DEEPBOOK_REGISTRY), tx.object(MARGIN_REGISTRY), tx.object(CLOCK)],
});
tx.moveCall({
  target: `${MARGIN_PKG}::margin_manager::deposit`,
  typeArguments: [SUI, DBUSDC, SUI],
  arguments: [mgr[0], tx.object(MARGIN_REGISTRY), tx.object(SUI_PRICE_INFO), tx.object(DBUSDC_PRICE_INFO), collateral, tx.object(CLOCK)],
});
tx.moveCall({
  target: `${MARGIN_PKG}::margin_manager::share`,
  typeArguments: [SUI, DBUSDC],
  arguments: [mgr[0], mgr[1]],
});

const res = await client.devInspectTransactionBlock({ sender: SENDER, transactionBlock: tx });
console.log("STATUS:", res.effects?.status?.status);
if (res.effects?.status?.error) console.log("ERROR :", res.effects.status.error);

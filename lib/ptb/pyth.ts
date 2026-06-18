/**
 * Pyth price-feed refresh for Sui — hand-rolled on @mysten/sui v2.
 *
 * deepbook_margin's `deposit`/`borrow` abort on `pyth::check_price_is_fresh`
 * (~60s staleness). Sui testnet's Pyth feeds are NOT kept fresh by a keeper, so
 * any margin PTB must first refresh the relevant PriceInfoObjects from a Hermes
 * VAA in the SAME transaction.
 *
 * The official @pythnetwork/pyth-sui-js SDK targets @mysten/sui v1, which is
 * incompatible with this project's v2. So we replicate its `updatePriceFeeds`
 * sequence directly, against v2 `Transaction`. Every Move target + arg order was
 * verified against the deployed ABI (sui_getNormalizedMoveModule):
 *
 *   1. wormhole::vaa::parse_and_verify(&State, vector<u8>, &Clock) -> VAA
 *   2. pyth::create_authenticated_price_infos_using_accumulator(
 *        &State, vector<u8> accumulatorMsg, VAA, &Clock) -> HotPotatoVector<PriceInfo>
 *   3. (per feed) pyth::update_single_price_feed(
 *        &State, HotPotatoVector<PriceInfo>, &mut PriceInfoObject, Coin<SUI>, &Clock)
 *        -> HotPotatoVector<PriceInfo>
 *   4. hot_potato_vector::destroy<price_info::PriceInfo>(HotPotatoVector<PriceInfo>)
 */

import { Transaction } from "@mysten/sui/transactions";
import { OBJECTS, PYTH, PYTH_TARGETS } from "@/lib/deepbook";

/** One feed to refresh: its Pyth feed id + the on-chain PriceInfoObject id. */
export interface PythFeedTarget {
  feedId: string;
  priceInfoObjectId: string;
}

/** A fetched Hermes update + the feeds it covers, ready to prepend to a PTB. */
export interface PythUpdatePayload {
  /** The raw accumulator message bytes (decoded from Hermes base64). */
  accumulatorMsg: Uint8Array;
  /** Feeds to update, in the order their PriceInfoObjects should be refreshed. */
  feeds: PythFeedTarget[];
}

/** Decode a base64 string to bytes (works in browser + Node ≥16). */
function b64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Node fallback
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

/**
 * Fetch a single accumulator update message from Hermes-beta covering all
 * requested feeds. Returns the raw message bytes (one message per the Pyth
 * accumulator model, regardless of feed count).
 */
export async function fetchPythAccumulatorUpdate(
  feedIds: string[],
): Promise<Uint8Array> {
  const params = feedIds
    .map(f => `ids[]=${f.replace(/^0x/, "")}`)
    .join("&");
  const url = `${PYTH.hermes}/v2/updates/price/latest?${params}&encoding=base64`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Hermes ${res.status} fetching Pyth update`);
  }
  const json = (await res.json()) as { binary?: { data?: string[] } };
  const data = json.binary?.data?.[0];
  if (!data) throw new Error("Hermes returned no accumulator data");
  return b64ToBytes(data);
}

/**
 * Extract the embedded VAA bytes from a Pyth accumulator message.
 * Layout (from the Pyth SDK): header(4) + major(1) + minor(1) +
 * trailingPayloadSize(1) + trailingPayload(var) + proofType(1) +
 * vaaSize(2, big-endian) + vaa(vaaSize).
 */
function extractVaaBytes(msg: Uint8Array): Uint8Array {
  const dv = new DataView(msg.buffer, msg.byteOffset, msg.byteLength);
  const trailingPayloadSize = dv.getUint8(6);
  const vaaSizeOffset = 7 + trailingPayloadSize + 1; // +1 proof_type byte
  const vaaSize = dv.getUint16(vaaSizeOffset, false); // big-endian
  const vaaOffset = vaaSizeOffset + 2;
  return msg.subarray(vaaOffset, vaaOffset + vaaSize);
}

/**
 * Append the Pyth refresh commands to an existing transaction. After these
 * commands, every listed PriceInfoObject holds a price fresh as of the Hermes
 * publish time — so a subsequent margin deposit/borrow passes the staleness
 * check. Must be added BEFORE the call that reads the prices.
 */
export function addPythPriceUpdate(
  tx: Transaction,
  payload: PythUpdatePayload,
): void {
  const { accumulatorMsg, feeds } = payload;
  if (feeds.length === 0) throw new Error("addPythPriceUpdate: no feeds");

  const vaa = extractVaaBytes(accumulatorMsg);

  // 1. Verify the VAA via Wormhole → VAA hot object
  const [verifiedVaa] = tx.moveCall({
    target: PYTH_TARGETS.parseAndVerify,
    arguments: [
      tx.object(PYTH.wormholeState),
      tx.pure.vector("u8", Array.from(vaa)),
      tx.object(OBJECTS.clock),
    ],
  });

  // 2. Authenticate the accumulator message → HotPotatoVector<PriceInfo>
  let [hotPotato] = tx.moveCall({
    target: PYTH_TARGETS.createPriceInfosAccum,
    arguments: [
      tx.object(PYTH.state),
      tx.pure.vector("u8", Array.from(accumulatorMsg)),
      verifiedVaa,
      tx.object(OBJECTS.clock),
    ],
  });

  // 3. One base-fee SUI coin per feed, split from gas
  const feeCoins = tx.splitCoins(
    tx.gas,
    feeds.map(() => tx.pure.u64(PYTH.baseUpdateFee)),
  );

  // 4. Update each PriceInfoObject, threading the hot potato through
  feeds.forEach((f, i) => {
    [hotPotato] = tx.moveCall({
      target: PYTH_TARGETS.updateSinglePriceFeed,
      arguments: [
        tx.object(PYTH.state),
        hotPotato,
        tx.object(f.priceInfoObjectId),
        feeCoins[i],
        tx.object(OBJECTS.clock),
      ],
    });
  });

  // 5. Consume the hot potato (must be destroyed before the PTB ends)
  tx.moveCall({
    target: PYTH_TARGETS.hotPotatoDestroy,
    typeArguments: [PYTH_TARGETS.priceInfoType],
    arguments: [hotPotato],
  });
}

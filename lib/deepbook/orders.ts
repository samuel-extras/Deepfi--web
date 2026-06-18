/**
 * On-chain order-id/price encoding helpers and BCS `Order` normalization into
 * UI units. DeepBook encodes side + price inside the u128 order id, and all
 * raw amounts are scaled by the coin's `scalar`.
 */
import { FLOAT_SCALAR, type Order } from "@mysten/deepbook-v3";
import type { SpotPoolMeta } from "./pools";

// tsconfig targets < ES2020, so no BigInt literals here
const B0 = BigInt(0);
const B63_MASK = (BigInt(1) << BigInt(63)) - BigInt(1);

/** DeepBook encodes side + price inside the u128 order id. */
export function decodeOrderId(encoded: bigint): {
  isBid: boolean;
  rawPrice: number;
} {
  const isBid = encoded >> BigInt(127) === B0;
  const rawPrice = Number((encoded >> BigInt(64)) & B63_MASK);
  return { isBid, rawPrice };
}

/** Raw on-chain price -> human price (quote per base). */
export function rawPriceToHuman(rawPrice: number, pool: SpotPoolMeta): number {
  return (rawPrice * pool.baseScalar) / (FLOAT_SCALAR * pool.quoteScalar);
}

/** Human price -> on-chain u64 (the SDK's convertPrice cross-scalar formula). */
export function humanToRawPrice(price: number, pool: SpotPoolMeta): bigint {
  return BigInt(
    Math.round((price * FLOAT_SCALAR * pool.quoteScalar) / pool.baseScalar)
  );
}

/** Human base quantity -> on-chain u64. */
export function humanToRawQuantity(qty: number, pool: SpotPoolMeta): bigint {
  return BigInt(Math.round(qty * pool.baseScalar));
}

export type OpenOrder = {
  orderId: string;
  clientOrderId: string;
  isBid: boolean;
  price: number;
  quantity: number; // base units (human)
  filled: number; // base units (human)
  remaining: number; // base units (human)
  expireTimestamp: number; // ms
};

type RawOrder = ReturnType<typeof Order.parse>;

/** Normalize a BCS Order (from getAccountOrderDetails) into UI units. */
export function normalizeOrder(raw: RawOrder, pool: SpotPoolMeta): OpenOrder {
  const { isBid, rawPrice } = decodeOrderId(BigInt(raw.order_id));
  const quantity = Number(raw.quantity) / pool.baseScalar;
  const filled = Number(raw.filled_quantity) / pool.baseScalar;
  return {
    orderId: raw.order_id,
    clientOrderId: raw.client_order_id,
    isBid,
    price: rawPriceToHuman(rawPrice, pool),
    quantity,
    filled,
    remaining: Math.max(0, quantity - filled),
    expireTimestamp: Number(raw.expire_timestamp),
  };
}

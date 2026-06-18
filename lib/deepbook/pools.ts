/**
 * DeepBook pool + coin metadata resolved for the active network, plus pool
 * lookup helpers. The SDK pool key (e.g. "SUI_DBUSDC") doubles as the indexer
 * pool name, so the same `SpotPoolMeta` drives both on-chain calls and the
 * REST/indexer reads.
 */
import { DB_COINS, DB_POOLS } from "./config";

export type SpotPoolMeta = {
  key: string; // SDK pool key, e.g. "SUI_DBUSDC" (also the indexer pool name)
  address: string;
  base: string; // coin key, e.g. "SUI"
  quote: string; // coin key, e.g. "DBUSDC"
  baseType: string;
  quoteType: string;
  baseScalar: number;
  quoteScalar: number;
  label: string; // "SUI / DBUSDC"
};

/** All DeepBook pools for the active network, with coin metadata resolved. */
export const SPOT_POOLS: SpotPoolMeta[] = Object.entries(DB_POOLS).map(
  ([key, pool]) => {
    const base = DB_COINS[pool.baseCoin];
    const quote = DB_COINS[pool.quoteCoin];
    return {
      key,
      address: pool.address,
      base: pool.baseCoin,
      quote: pool.quoteCoin,
      baseType: base.type,
      quoteType: quote.type,
      baseScalar: base.scalar,
      quoteScalar: quote.scalar,
      label: `${pool.baseCoin} / ${pool.quoteCoin}`,
    };
  }
);

export const DEFAULT_POOL_KEY = SPOT_POOLS.some(p => p.key === "SUI_DBUSDC")
  ? "SUI_DBUSDC"
  : SPOT_POOLS[0]?.key ?? "";

export function getSpotPool(poolKey: string): SpotPoolMeta {
  const pool = SPOT_POOLS.find(p => p.key === poolKey);
  if (!pool) throw new Error(`Unknown DeepBook pool: ${poolKey}`);
  return pool;
}

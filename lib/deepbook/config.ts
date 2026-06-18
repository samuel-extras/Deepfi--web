/**
 * DeepBook V3 network configuration — package IDs plus coin and pool tables for
 * the active network. DeepBook ships default configs for mainnet + testnet only,
 * so anything that isn't mainnet falls back to testnet.
 *
 * Shared by every DeepBook trading surface (spot, margin); import the resolved
 * metadata from `./pools` rather than reaching for the raw `DB_*` tables.
 */
import {
  mainnetCoins,
  mainnetPackageIds,
  mainnetPools,
  testnetCoins,
  testnetPackageIds,
  testnetPools,
} from "@mysten/deepbook-v3";
import { SUI_NETWORK } from "@/lib/sui/network";

/** DeepBook ships default configs for mainnet + testnet only. */
export const DB_NETWORK = SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";

export const DB_PKG =
  DB_NETWORK === "mainnet" ? mainnetPackageIds : testnetPackageIds;
export const DB_COINS = DB_NETWORK === "mainnet" ? mainnetCoins : testnetCoins;
export const DB_POOLS = DB_NETWORK === "mainnet" ? mainnetPools : testnetPools;

/** Key under which the user's BalanceManager is registered in the SDK config. */
export const MANAGER_KEY = "MANAGER";

/** Coin keys we surface in the account panel (order = display order). */
export const ACCOUNT_COINS = Object.keys(DB_COINS);

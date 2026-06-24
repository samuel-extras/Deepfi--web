"use client";

/**
 * USD value of the user's plain wallet address holdings — the assets that live
 * in the wallet itself, NOT in any DeepBook/Predict manager. This is the
 * "Wallet" leg of the total-balance figure (alongside Spot, Margin, and
 * Predictions, which are the manager accounts).
 *
 * Pricing: testnet DeepBook pools are quoted in DBUSDC (≈ $1), so a coin's USD
 * price is its `<COIN>_DBUSDC` last price; stablecoins are $1. dUSDC is the
 * Predict quote (not a DeepBook coin), so it's read separately and valued at $1.
 */
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useWalletBalances } from "@/lib/deepbook/hooks/reads";
import { useMarketSummary } from "@/lib/deepbook/api/queries";
import { COIN_TYPES } from "@/lib/deepbook";

/** Stablecoins valued at $1 (no pool lookup needed). */
const STABLES = new Set(["DBUSDC", "DBUSDT"]);

/** Coin key → the DBUSDC pool whose last price is its ≈USD price. */
const PRICE_POOL: Record<string, string> = {
  SUI: "SUI_DBUSDC",
  DEEP: "DEEP_DBUSDC",
  DBTC: "DBTC_DBUSDC",
  WAL: "WAL_DBUSDC",
};

export function useWalletUsd(): { walletUsd: number; isLoading: boolean } {
  const owner = useActiveAccount()?.address;
  const { data: balances, isLoading: balLoading } = useWalletBalances();
  const { data: summary } = useMarketSummary();

  // dUSDC is the Predict quote asset and isn't a DeepBook coin, so read it
  // directly. It's a stablecoin → $1.
  const dusdcQ = useSuiClientQuery(
    "getBalance",
    { owner: owner ?? "", coinType: COIN_TYPES.dusdc },
    { enabled: !!owner, refetchInterval: 15_000 },
  );
  const walletDusdc = Number(dusdcQ.data?.totalBalance ?? 0) / 1e6;

  let walletUsd = walletDusdc; // dUSDC ≈ $1
  for (const [coin, amount] of Object.entries(balances ?? {})) {
    if (!amount) continue;
    const price = STABLES.has(coin)
      ? 1
      : PRICE_POOL[coin]
        ? Number(summary?.[PRICE_POOL[coin]]?.last_price ?? 0)
        : 0;
    walletUsd += amount * price;
  }

  return { walletUsd, isLoading: balLoading || dusdcQ.isLoading };
}

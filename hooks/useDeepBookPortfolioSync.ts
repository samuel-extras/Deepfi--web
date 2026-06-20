"use client";

/**
 * Feeds the portfolio UI with REAL DeepBook data on /portfolio:
 *  - spot balances  <- DeepBook collateral balances (/api/deepbook/portfolio)
 *  - margin overview <- DeepBook margin equity/debt
 *  - predictions balance <- DeepBook Predict account value (/api/portfolio)
 *
 * This hook is the sole writer of the balance store.
 */
import { useEffect } from "react";
import {
  useBalanceStore,
  type SpotBalance,
  type MarginOverview,
} from "@/stores/useBalanceStore";

type DBPortfolio = {
  ok: boolean;
  collateral_balances: { asset: string; balance: number; balance_usd: number }[];
  margin_positions: { total_debt_usd: number; net_value_usd: number }[];
  summary: { total_equity_usd: number; total_debt_usd: number; net_value_usd: number };
};

export function useDeepBookPortfolioSync(walletAddress: string) {
  const setMarginOverview = useBalanceStore(s => s.setMarginOverview);
  const setSpotBalances = useBalanceStore(s => s.setSpotBalances);
  const setPredictionsBalance = useBalanceStore(s => s.setPredictionsBalance);

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;

    const sync = async () => {
      try {
        const p = (await fetch(
          `/api/deepbook/portfolio?wallet=${walletAddress}`,
          { cache: "no-store" }
        ).then(r => r.json())) as DBPortfolio;
        if (cancelled || !p.ok) return;

        // collateral -> spot balances (the assets/distribution panels)
        const spot: SpotBalance[] = (p.collateral_balances ?? []).map((c, i) => ({
          coin: c.asset,
          token: i,
          hold: "0",
          total: String(c.balance ?? 0),
          entryNtl: String(c.balance_usd ?? 0),
        }));
        setSpotBalances(spot);

        // margin summary -> margin overview cards
        const overview: MarginOverview = {
          withdrawable: String(p.summary?.net_value_usd ?? 0),
          accountValue: String(p.summary?.total_equity_usd ?? 0),
          totalDebt: String(p.summary?.total_debt_usd ?? 0),
        };
        setMarginOverview(overview);
      } catch {
        /* keep last values */
      }

      // predictions balance <- DeepBook Predict account value
      try {
        const pr = await fetch(`/api/portfolio?owner=${walletAddress}`, {
          cache: "no-store",
        }).then(r => r.json());
        if (cancelled) return;
        const v = pr?.summary?.accountValue;
        if (typeof v === "number") setPredictionsBalance(String(v));
      } catch {
        /* leave predictions as-is */
      }
    };

    sync();
    const id = setInterval(sync, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [walletAddress, setMarginOverview, setSpotBalances, setPredictionsBalance]);
}

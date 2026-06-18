"use client";

import { useMemo } from "react";
import {
  useMarginOverview,
  useSpotBalances,
  usePredictionsBalance,
} from "@/stores/useBalanceStore";
import { formatNumber } from "@/lib/format";

const usd = (value: number) =>
  formatNumber(value, "price", {
    symbol: "$",
    symbolPosition: "prefix",
    precision: 2,
    minimumFractionDigits: 2,
  });

const PortfolioSummary = () => {
  const marginOverview = useMarginOverview();
  const spotBalances = useSpotBalances();
  const predictionsBalance = parseFloat(usePredictionsBalance() || "0");

  const { spotBalance, marginEquity, marginDebt, totalAssets } =
    useMemo(() => {
      // Spot balance — DeepBook collateral balances carry their USD value.
      const spot = spotBalances.reduce(
        (sum, b) => sum + parseFloat(b.entryNtl || "0"),
        0
      );

      const equity = parseFloat(marginOverview?.accountValue || "0");
      const debt = parseFloat(marginOverview?.totalDebt || "0");

      // Total assets = spot + margin equity + predictions
      const total = spot + equity + predictionsBalance;

      return {
        spotBalance: spot,
        marginEquity: equity,
        marginDebt: debt,
        totalAssets: total,
      };
    }, [marginOverview, spotBalances, predictionsBalance]);

  const accountData = useMemo(
    () => [
      { title: "Spot Balance", value: usd(spotBalance) },
      { title: "Margin Equity", value: usd(marginEquity) },
      { title: "Margin Debt", value: usd(marginDebt) },
      { title: "Predictions Balance", value: usd(predictionsBalance) },
    ],
    [spotBalance, marginEquity, marginDebt, predictionsBalance]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-nav-inactive font-normal mb-2">
            Total Assets
          </p>
          <h1 className="text-2xl text-white font-bold">{usd(totalAssets)}</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        {accountData.map(item => (
          <AccountCard key={item.title} title={item.title} value={item.value} />
        ))}
      </div>
    </div>
  );
};

export default PortfolioSummary;

const AccountCard = ({
  title,
  value,
}: {
  title: string;
  value: string | React.ReactNode;
}) => {
  return (
    <div className="w-full border border-border rounded-2xl p-4">
      <p className="text-xs text-nav-inactive font-normal mb-1">{title}</p>
      <h2 className="text-base text-white font-semibold">{value}</h2>
    </div>
  );
};

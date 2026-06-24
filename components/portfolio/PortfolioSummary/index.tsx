"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import {
  useMarginOverview,
  useSpotBalances,
  usePredictionsBalance,
} from "@/stores/useBalanceStore";
import { useWalletUsd } from "@/hooks/useWalletUsd";
import { formatNumber } from "@/lib/format";
import { TransferModal } from "@/components/wallet/TransferModal";

const usd = (value: number) =>
  formatNumber(value, "price", {
    symbol: "$",
    symbolPosition: "prefix",
    precision: 2,
    minimumFractionDigits: 2,
  });

const PortfolioSummary = () => {
  const [transferOpen, setTransferOpen] = useState(false);
  const marginOverview = useMarginOverview();
  const spotBalances = useSpotBalances();
  const predictionsBalance = parseFloat(usePredictionsBalance() || "0");
  // Loose coins in the wallet address (priced to USD), disjoint from the
  // manager accounts below.
  const { walletUsd } = useWalletUsd();

  const { spotBalance, marginEquity, marginDebt, totalAssets } =
    useMemo(() => {
      // Spot balance — DeepBook collateral balances carry their USD value.
      const spot = spotBalances.reduce(
        (sum, b) => sum + parseFloat(b.entryNtl || "0"),
        0
      );

      const equity = parseFloat(marginOverview?.accountValue || "0");
      const debt = parseFloat(marginOverview?.totalDebt || "0");

      // Total assets = wallet + spot + margin equity + predictions
      const total = walletUsd + spot + equity + predictionsBalance;

      return {
        spotBalance: spot,
        marginEquity: equity,
        marginDebt: debt,
        totalAssets: total,
      };
    }, [marginOverview, spotBalances, predictionsBalance, walletUsd]);

  const accountData = useMemo(
    () => [
      { title: "Wallet", value: usd(walletUsd) },
      { title: "Spot Balance", value: usd(spotBalance) },
      { title: "Margin Equity", value: usd(marginEquity) },
      { title: "Margin Debt", value: usd(marginDebt) },
      { title: "Predictions Balance", value: usd(predictionsBalance) },
    ],
    [walletUsd, spotBalance, marginEquity, marginDebt, predictionsBalance]
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
        <button
          type="button"
          onClick={() => setTransferOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-transparent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/5"
        >
          <ArrowLeftRight className="size-3.5 text-[#02DA8B]" />
          Transfer
        </button>
      </div>

      <TransferModal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        defaultVenue="predictions"
      />

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

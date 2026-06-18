"use client";

import { useMemo } from "react";
import {
  useMarginOverview,
  useSpotBalances,
  usePredictionsBalance,
} from "@/stores/useBalanceStore";
import { fromDeepBookSymbol } from "@/lib/format";
import { TokenIcon } from "@/components/ui/token-icon";

interface AssetRow {
  token: string;
  displayName: string;
  balance: number;
  usdValue: number;
  type: "margin" | "spot" | "predictions";
}

const AssetsContent = () => {
  const marginOverview = useMarginOverview();
  const spotBalances = useSpotBalances();
  const predictionsBalance = parseFloat(usePredictionsBalance() || "0");

  const assets = useMemo<AssetRow[]>(() => {
    const assetList: AssetRow[] = [];

    // DeepBook spot / collateral balances (entryNtl = USD value)
    spotBalances.forEach(b => {
      const total = parseFloat(b.total || "0");
      if (total === 0) return;

      const symbol = fromDeepBookSymbol(b.coin);
      const usdValue = parseFloat(b.entryNtl || "0");

      assetList.push({
        token: symbol,
        displayName: `${symbol} (Spot)`,
        balance: total,
        usdValue,
        type: "spot",
      });
    });

    // DeepBook margin net value
    const marginNet = parseFloat(marginOverview?.withdrawable || "0");
    if (marginNet > 0) {
      assetList.push({
        token: "USDC",
        displayName: "USDC (Margin)",
        balance: marginNet,
        usdValue: marginNet,
        type: "margin",
      });
    }

    // DeepBook Predict balance
    if (predictionsBalance > 0) {
      assetList.push({
        token: "USDC",
        displayName: "dUSDC (Predictions)",
        balance: predictionsBalance,
        usdValue: predictionsBalance,
        type: "predictions",
      });
    }

    // Sort by USD value descending
    return assetList.sort((a, b) => b.usdValue - a.usdValue);
  }, [marginOverview, spotBalances, predictionsBalance]);

  if (assets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-10">
        <p className="text-xs text-nav-inactive">No assets yet</p>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <table className="w-full caption-bottom text-sm">
        <tbody className="[&_tr]:border-0">
          {assets.map((asset, index) => {
            const isLastRow = index === assets.length - 1;
            const unitPrice =
              asset.balance > 0 ? asset.usdValue / asset.balance : 0;
            return (
              <tr
                key={`${asset.token}-${asset.type}`}
                className="cursor-default"
              >
                <td
                  className={`text-left py-4 align-middle ${
                    !isLastRow ? "border-b border-border" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol={asset.token} size={28} />
                    <div className="flex flex-col">
                      <p className="text-white font-semibold text-xs">
                        {asset.displayName}
                      </p>
                      <p className="text-nav-inactive text-xs">
                        $
                        {unitPrice.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                </td>

                <td
                  className={`text-right py-4 px-4 align-middle whitespace-nowrap ${
                    !isLastRow ? "border-b border-border" : ""
                  }`}
                >
                  <p className="text-white font-semibold text-xs">
                    {asset.balance.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: asset.type === "spot" ? 8 : 2,
                    })}
                  </p>
                </td>

                <td
                  className={`text-right py-4 px-4 align-middle whitespace-nowrap ${
                    !isLastRow ? "border-b border-border" : ""
                  }`}
                >
                  <p className="text-white font-semibold text-xs">
                    $
                    {asset.usdValue.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AssetsContent;

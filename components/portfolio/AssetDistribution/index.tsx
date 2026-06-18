"use client";

import { useMemo } from "react";
import {
  useMarginOverview,
  useSpotBalances,
  usePredictionsBalance,
} from "@/stores/useBalanceStore";
import { formatNumber, fromDeepBookSymbol } from "@/lib/format";
import CustomPieChart from "@/components/Charts/CustomPieChart";
import formatSymbol from "@/lib/formatSymbol";

// Color palette for assets
const ASSET_COLORS = [
  "#02da8b", // green
  "#f97316", // orange
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#eab308", // yellow
  "#ef4444", // red
  "#6366f1", // indigo
  "#84cc16", // lime
];

const AssetDistribution = () => {
  const marginOverview = useMarginOverview();
  const spotBalances = useSpotBalances();
  const predictionsBalance = parseFloat(usePredictionsBalance() || "0");

  const { assetData, totalValue } = useMemo(() => {
    // Build asset map from DeepBook spot balances (entryNtl = USD value)
    const assetMap: Record<string, number> = {};

    spotBalances.forEach(balance => {
      const usdValue = parseFloat(balance.entryNtl || "0");
      if (usdValue <= 0) return;

      const symbol = formatSymbol(fromDeepBookSymbol(balance.coin));
      assetMap[symbol] = (assetMap[symbol] || 0) + usdValue;
    });

    // Margin net value counts towards USDC-equivalent holdings
    const marginNet = parseFloat(marginOverview?.withdrawable || "0");
    if (marginNet > 0) {
      assetMap["Margin"] = (assetMap["Margin"] || 0) + marginNet;
    }

    // Predictions dUSDC
    if (predictionsBalance > 0) {
      assetMap["Predictions"] =
        (assetMap["Predictions"] || 0) + predictionsBalance;
    }

    // Calculate total value
    const total = Object.values(assetMap).reduce((sum, val) => sum + val, 0);

    // Convert to array and sort by value descending
    const sortedAssets = Object.entries(assetMap)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
      }))
      .filter(asset => asset.value > 0)
      .sort((a, b) => b.value - a.value);

    // Take top 3 assets, group the rest under "Others"
    const TOP_ASSETS_COUNT = 3;
    const topAssets = sortedAssets.slice(0, TOP_ASSETS_COUNT);
    const remainingAssets = sortedAssets.slice(TOP_ASSETS_COUNT);

    const othersValue = remainingAssets.reduce(
      (sum, asset) => sum + asset.value,
      0
    );
    const othersPercentage = total > 0 ? (othersValue / total) * 100 : 0;

    const assets = [
      ...topAssets.map((asset, index) => ({
        ...asset,
        color: ASSET_COLORS[index],
      })),
      ...(othersValue > 0
        ? [
            {
              name: "Others",
              value: othersValue,
              percentage: othersPercentage,
              color: "#6b7280", // gray for Others
            },
          ]
        : []),
    ];

    const totalFormatted = formatNumber(total, "price", {
      symbol: "$",
      symbolPosition: "prefix",
      precision: 2,
      minimumFractionDigits: 2,
    });

    return { assetData: assets, totalValue: totalFormatted };
  }, [marginOverview, spotBalances, predictionsBalance]);

  return (
    <div className="p-4 bg-[#1A1D1F] rounded-2xl">
      <p className="text-xs text-white font-semibold mb-6">
        Asset Distribution
      </p>

      <div className="flex gap-3 lg:gap-4 items-center">
        <div className="flex-1 flex items-center justify-center">
          <CustomPieChart
            data={assetData}
            size={200}
            cornerRadius={20}
            animationDuration={800}
            totalTitle="Total"
            totalValue={totalValue}
          />
        </div>
        <div className="w-1/2 space-y-3">
          {assetData.map(item => (
            <div
              key={item.name}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-1">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <p className="flex-1 text-xs text-white font-medium">
                  {item.name}
                </p>
              </div>
              <p className="text-xs font-medium text-nav-inactive">
                {formatNumber(item.percentage, "percent")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AssetDistribution;

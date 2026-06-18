"use client";

import dynamic from "next/dynamic";
import { useAuthStore } from "@/stores/useAuthStore";
import { useDeepBookPortfolioSync } from "@/hooks/useDeepBookPortfolioSync";
import {
  PanelFallback,
  TableFallback,
} from "@/components/ui/RouteStreamingFallbacks";

const PortfolioSummary = dynamic(
  () => import("@/components/portfolio/PortfolioSummary"),
  { loading: () => <PanelFallback className="h-64" /> }
);
const AssetDistribution = dynamic(
  () => import("@/components/portfolio/AssetDistribution"),
  { loading: () => <PanelFallback className="h-56" /> }
);
const AssetsTable = dynamic(
  () => import("@/components/portfolio/AssetsTable"),
  { loading: () => <TableFallback rows={6} /> }
);

export default function Portfolio() {
  const { userInfo } = useAuthStore();
  const walletAddress = userInfo.walletAddress || "";

  // Feed the panels with real DeepBook portfolio data.
  useDeepBookPortfolioSync(walletAddress);

  return (
    <div className="px-4 py-6 w-full lg:max-w-[87.5%] mx-auto text-sm text-white/80 space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        <div className="w-full lg:w-[40%] flex flex-col">
          <PortfolioSummary />
        </div>
        <div className="w-full lg:flex-1 flex flex-col">
          <AssetDistribution />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <AssetsTable />
      </div>
    </div>
  );
}

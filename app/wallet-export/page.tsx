"use client";
import dynamic from "next/dynamic";
import { WalletExportPageSkeleton } from "@/components/ui/RouteStreamingFallbacks";

const WalletExportClient = dynamic(() => import("./WalletExportClient"), {
  loading: () => <WalletExportPageSkeleton />,
});

export default function WalletExportPage() {
  return <WalletExportClient />;
}

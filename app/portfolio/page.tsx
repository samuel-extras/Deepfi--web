"use client";

import dynamic from "next/dynamic";
import { PortfolioPageSkeleton } from "@/components/ui/RouteStreamingFallbacks";

const Portfolio = dynamic(() => import("@/components/portfolio"), {
  loading: () => <PortfolioPageSkeleton />,
});

export default function PortfolioPage() {
  return <Portfolio />;
}

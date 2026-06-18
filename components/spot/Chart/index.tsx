"use client";

/**
 * Lazy, client-only chart wrapper. Defined once and shared by both spot
 * layouts so the TradingView widget binds to a single dynamic component
 * instance (its module-level singleton then guarantees one live widget).
 */
import dynamic from "next/dynamic";

const SpotChart = dynamic(() => import("./TVChart"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#16191C]" />,
});

export default SpotChart;

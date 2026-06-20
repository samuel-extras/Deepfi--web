// Single-oracle page header — asset mark, param-driven title + status, and a
// strip of live stats (spot, ATM strike, IV, or settlement). Mirrors the
// Polymarket market header but driven entirely by the oracle in the URL param.
"use client";

import { useEffect, useState } from "react";
import { Share2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OracleDetail } from "@/lib/predict";
import { ASSET_NAME, countdown, expiryLabel, oracleTitle } from "./format";
import { BitcoinIcon } from "@/components/icons/token-icons";

export function OracleHeader({ detail }: { detail: OracleDetail }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!detail.live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [detail.live]);

  const badge = detail.live
    ? { label: "Live", variant: "success" as const }
    : detail.status === "settled"
      ? { label: "Settled", variant: "secondary" as const }
      : { label: "Settling", variant: "outline" as const };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl  text-lg font-bold text-white">
          <BitcoinIcon size={44} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-bold sm:text-xl">
              {oracleTitle(detail)}
            </h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ASSET_NAME[detail.asset] ?? detail.asset} ·{" "}
            {detail.live
              ? `settles in ${countdown(detail.expiry - now)}`
              : "settled"}{" "}
            · {expiryLabel(detail.expiry)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Share">
            <Share2 />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Add to watchlist">
            <Star />
          </Button>
        </div>
      </div>

      {/* <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {detail.forward != null && <Stat label="Forward" value={usd0(detail.forward)} />}
        {detail.atmStrike != null && (
          <Stat label="ATM strike" value={usd0(detail.atmStrike)} />
        )}
        {detail.atmIv != null && detail.atmIv < 1000 && (
          <Stat label="ATM IV" value={`${detail.atmIv.toFixed(0)}%`} />
        )}
        {detail.settlementPrice != null && (
          <Stat label="Settlement" value={usd0(detail.settlementPrice)} />
        )}
        <Stat label="Strike grid" value={`${usd0(detail.minStrike)} · $${detail.tickSize} tick`} />
      </div> */}
    </div>
  );
}

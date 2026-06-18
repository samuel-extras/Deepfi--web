import { NextResponse } from "next/server";
import { indexer } from "@/lib/indexer";
import { fromDusdcU64, fromPriceU64 } from "@/lib/deepbook";
import type { FeedTrade } from "@/lib/types";

export const dynamic = "force-dynamic";

export const revalidate = 5;

function expiryMinutes(expiryMs: number, mintedMs: number): number {
  return Math.max(1, Math.round((expiryMs - mintedMs) / 60_000));
}

export async function GET() {
  try {
    const [positions, ranges] = await Promise.all([
      indexer.positionsMinted().catch(() => []),
      indexer.rangesMinted().catch(() => []),
    ]);

    const fromRanges: FeedTrade[] = ranges.map((r, i) => ({
      id: `r-${r.event_digest ?? i}`,
      txDigest: r.digest,
      sender: r.trader ?? r.sender,
      direction: "up",
      leverage: 1,
      range: {
        strikeLow: fromPriceU64(r.lower_strike),
        strikeHigh: fromPriceU64(r.higher_strike),
        expiryMinutes: expiryMinutes(r.expiry, r.checkpoint_timestamp_ms),
      },
      sizeDusdc: fromDusdcU64(r.cost),
      isCombo: false,
      timestamp: r.checkpoint_timestamp_ms,
    }));

    const fromPositions: FeedTrade[] = positions.map((p, i) => ({
      id: `p-${p.event_digest ?? i}`,
      txDigest: p.digest,
      sender: p.trader ?? p.sender,
      direction: p.is_up ? "up" : "down",
      leverage: 1,
      range: {
        strikeLow: fromPriceU64(p.strike),
        strikeHigh: fromPriceU64(p.strike),
        expiryMinutes: expiryMinutes(p.expiry, p.checkpoint_timestamp_ms),
      },
      sizeDusdc: fromDusdcU64(p.cost),
      isCombo: false,
      timestamp: p.checkpoint_timestamp_ms,
    }));

    const trades = [...fromRanges, ...fromPositions]
      .filter((t) => Number.isFinite(t.timestamp))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 40);

    return NextResponse.json({ trades, live: true });
  } catch (e) {
    return NextResponse.json(
      { trades: [], live: false, error: String(e) },
      { status: 200 },
    );
  }
}

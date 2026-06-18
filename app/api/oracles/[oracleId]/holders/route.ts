import { NextResponse } from "next/server";
import { indexer } from "@/lib/indexer";
import { fromDusdcU64 } from "@/lib/deepbook";

export const revalidate = 10;

/**
 * GET /api/oracles/:oracleId/holders
 *
 * Top holders for one oracle, aggregated from mint events (binary + range).
 * There's no per-oracle holder endpoint on the indexer, so we pull recent
 * mints, filter to this oracle, and sum premium paid per trader.
 */
type Acc = {
  address: string;
  sizeDusdc: number;
  trades: number;
  up: number;
  down: number;
  range: number;
};

function sideOf(a: Acc): "up" | "down" | "range" | "mixed" {
  if (a.range > a.up + a.down) return "range";
  if (a.up > 0 && a.down > 0) return "mixed";
  if (a.up > 0) return "up";
  if (a.down > 0) return "down";
  return "mixed";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ oracleId: string }> },
) {
  const { oracleId } = await params;
  try {
    const [positions, ranges] = await Promise.all([
      indexer.positionsMinted(400).catch(() => []),
      indexer.rangesMinted(400).catch(() => []),
    ]);

    const map = new Map<string, Acc>();
    const bump = (addr: string, size: number, side: "up" | "down" | "range") => {
      if (!addr || !(size > 0)) return;
      const a =
        map.get(addr) ??
        { address: addr, sizeDusdc: 0, trades: 0, up: 0, down: 0, range: 0 };
      a.sizeDusdc += size;
      a.trades += 1;
      a[side] += size;
      map.set(addr, a);
    };

    for (const p of positions) {
      if (p.oracle_id !== oracleId) continue;
      bump(p.trader ?? p.sender, fromDusdcU64(p.cost), p.is_up ? "up" : "down");
    }
    for (const r of ranges) {
      if (r.oracle_id !== oracleId) continue;
      bump(r.trader ?? r.sender, fromDusdcU64(r.cost), "range");
    }

    const holders = [...map.values()]
      .sort((a, b) => b.sizeDusdc - a.sizeDusdc)
      .slice(0, 15)
      .map((a) => ({
        address: a.address,
        sizeDusdc: a.sizeDusdc,
        trades: a.trades,
        side: sideOf(a),
      }));

    return NextResponse.json({ ok: true, oracleId, holders });
  } catch (e) {
    return NextResponse.json({ ok: false, holders: [], error: String(e) });
  }
}

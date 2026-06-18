import { NextRequest, NextResponse } from "next/server";
import { indexer } from "@/lib/indexer";
import { fromDusdcU64, fromPriceU64 } from "@/lib/deepbook";
import type { RangeSummaryRow } from "@/lib/indexer";

export const dynamic = "force-dynamic";

interface ManagerSummary {
  trading_balance: number;
  open_exposure: number;
  redeemable_value: number;
  realized_pnl: number;
  unrealized_pnl: number;
  account_value: number;
  open_positions: number;
  awaiting_settlement_positions: number;
}

interface PositionSummary {
  oracle_id: string;
  underlying_asset: string;
  expiry: number;
  strike: number;
  is_up: boolean;
  open_quantity: number;
  total_cost: number;
  mark_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  average_entry_price: number;
  mark_price: number;
  status: string;
}

/** GET /api/portfolio?owner=0x... -> live PredictManager account + positions (binary + range). */
export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner");
  if (!owner) return NextResponse.json({ ok: false, error: "owner required" });

  try {
    const managers = await indexer.managers();
    const mine = managers
      .filter((m) => m.owner === owner)
      .sort((a, b) => b.checkpoint_timestamp_ms - a.checkpoint_timestamp_ms);
    const managerId = mine[0]?.manager_id;
    if (!managerId) {
      return NextResponse.json({ ok: true, managerId: null });
    }

    const [summaryRaw, positionsRaw, rangesRaw] = await Promise.all([
      indexer.managerSummary(managerId) as Promise<ManagerSummary>,
      (indexer.managerPositions(managerId) as Promise<PositionSummary[]>).catch(
        () => [] as PositionSummary[],
      ),
      indexer.managerRanges(managerId).catch(() => [] as RangeSummaryRow[]),
    ]);

    const summary = {
      tradingBalance: fromDusdcU64(summaryRaw.trading_balance),
      openExposure: fromDusdcU64(summaryRaw.open_exposure),
      redeemableValue: fromDusdcU64(summaryRaw.redeemable_value),
      realizedPnl: fromDusdcU64(summaryRaw.realized_pnl),
      unrealizedPnl: fromDusdcU64(summaryRaw.unrealized_pnl),
      accountValue: fromDusdcU64(summaryRaw.account_value),
      openPositions: summaryRaw.open_positions,
      awaitingSettlement: summaryRaw.awaiting_settlement_positions,
    };

    // Map binary positions (kind: "binary")
    const binaryPositions = (positionsRaw ?? [])
      .filter((p) => p.open_quantity > 0 || p.status !== "closed")
      .map((p) => ({
        oracleId: p.oracle_id,
        asset: p.underlying_asset,
        expiry: p.expiry,
        kind: "binary" as const,
        strike: fromPriceU64(p.strike),
        isUp: p.is_up,
        openQty: p.open_quantity,
        cost: fromDusdcU64(p.total_cost),
        markValue: fromDusdcU64(p.mark_value),
        unrealizedPnl: fromDusdcU64(p.unrealized_pnl),
        realizedPnl: fromDusdcU64(p.realized_pnl),
        status: p.status,
      }));

    // Map range positions (kind: "range")
    const rangePositions = (rangesRaw ?? [])
      .filter((p) => p.open_quantity > 0 || p.status !== "closed")
      .map((p) => ({
        oracleId: p.oracle_id,
        asset: p.underlying_asset,
        expiry: p.expiry,
        kind: "range" as const,
        lowerStrike: fromPriceU64(p.lower_strike),
        higherStrike: fromPriceU64(p.higher_strike),
        openQty: p.open_quantity,
        cost: fromDusdcU64(p.total_cost),
        markValue: fromDusdcU64(p.mark_value),
        unrealizedPnl: fromDusdcU64(p.unrealized_pnl),
        realizedPnl: fromDusdcU64(p.realized_pnl),
        status: p.status,
      }));

    // Merge, most recent expiry first
    const positions = [...binaryPositions, ...rangePositions].sort(
      (a, b) => a.expiry - b.expiry,
    );

    return NextResponse.json({ ok: true, managerId, summary, positions });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}

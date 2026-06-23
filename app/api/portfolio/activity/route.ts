import { NextRequest, NextResponse } from "next/server";
import { indexer } from "@/lib/indexer";
import { fromDusdcU64, fromPriceU64 } from "@/lib/deepbook";
import { CONTRACT_SCALE, positionOutcome, positionTitle } from "@/lib/predict/positionView";

export const dynamic = "force-dynamic";

interface ActivityRow {
  key: string;
  side: "BUY" | "SELL";
  type: "MINT" | "REDEEM";
  kind: "binary" | "range";
  oracleId: string;
  title: string;
  outcome: string;
  size: string; // human contracts, 2dp
  price: number; // USD per contract (0..1)
  usdcSize: number; // USD notional
  timestamp: number; // SECONDS (ActivityCard multiplies by 1000)
  transactionHash: string;
  ts: number; // ms, for client-side sorting/windowing
  settled?: boolean;
}

const contracts = (rawQty: number) => rawQty / CONTRACT_SCALE;
const perContract = (usd: number, rawQty: number) => {
  const c = contracts(rawQty);
  return c > 0 ? usd / c : 0;
};

/**
 * GET /api/portfolio/activity?owner=0x...
 * The connected wallet's mint (BUY) + redeem (SELL) history across binary and
 * range markets, newest first, plus a derived realized-cashflow P&L series.
 */
export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner");
  if (!owner) return NextResponse.json({ ok: false, error: "owner required" });

  try {
    const [pm, pr, rm, rr, oracles] = await Promise.all([
      indexer.positionsMinted(500),
      indexer.positionsRedeemed(500),
      indexer.rangesMinted(500),
      indexer.rangesRedeemed(500),
      indexer.oracles(),
    ]);
    const assetById = new Map(oracles.map((o) => [o.oracle_id, o.underlying_asset]));

    const rows: ActivityRow[] = [];

    for (const m of pm) {
      if (m.trader !== owner && m.sender !== owner) continue;
      const usd = fromDusdcU64(m.cost);
      rows.push({
        key: m.event_digest || `${m.digest}:bm`,
        side: "BUY",
        type: "MINT",
        kind: "binary",
        oracleId: m.oracle_id,
        title: positionTitle({
          oracleId: m.oracle_id,
          asset: assetById.get(m.oracle_id),
          expiry: m.expiry,
          kind: "binary",
          strike: fromPriceU64(m.strike),
          isUp: m.is_up,
          openQty: m.quantity,
          cost: usd,
          markValue: 0,
          unrealizedPnl: 0,
          realizedPnl: 0,
          status: "active",
        }),
        outcome: positionOutcome({ kind: "binary", isUp: m.is_up }),
        size: contracts(m.quantity).toFixed(2),
        price: perContract(usd, m.quantity),
        usdcSize: usd,
        timestamp: Math.floor(m.checkpoint_timestamp_ms / 1000),
        transactionHash: m.digest,
        ts: m.checkpoint_timestamp_ms,
      });
    }

    for (const r of pr) {
      if (r.owner !== owner) continue;
      const usd = fromDusdcU64(r.payout);
      rows.push({
        key: r.event_digest || `${r.digest}:br`,
        side: "SELL",
        type: "REDEEM",
        kind: "binary",
        oracleId: r.oracle_id,
        title: positionTitle({
          oracleId: r.oracle_id,
          asset: assetById.get(r.oracle_id),
          expiry: r.expiry,
          kind: "binary",
          strike: fromPriceU64(r.strike),
          isUp: r.is_up,
          openQty: r.quantity,
          cost: 0,
          markValue: usd,
          unrealizedPnl: 0,
          realizedPnl: 0,
          status: "settled",
        }),
        outcome: positionOutcome({ kind: "binary", isUp: r.is_up }),
        size: contracts(r.quantity).toFixed(2),
        price: perContract(usd, r.quantity),
        usdcSize: usd,
        timestamp: Math.floor(r.checkpoint_timestamp_ms / 1000),
        transactionHash: r.digest,
        ts: r.checkpoint_timestamp_ms,
        settled: r.is_settled,
      });
    }

    for (const m of rm) {
      if (m.trader !== owner && m.sender !== owner) continue;
      const usd = fromDusdcU64(m.cost);
      rows.push({
        key: m.event_digest || `${m.digest}:rm`,
        side: "BUY",
        type: "MINT",
        kind: "range",
        oracleId: m.oracle_id,
        title: positionTitle({
          oracleId: m.oracle_id,
          asset: assetById.get(m.oracle_id),
          expiry: m.expiry,
          kind: "range",
          lowerStrike: fromPriceU64(m.lower_strike),
          higherStrike: fromPriceU64(m.higher_strike),
          openQty: m.quantity,
          cost: usd,
          markValue: 0,
          unrealizedPnl: 0,
          realizedPnl: 0,
          status: "active",
        }),
        outcome: positionOutcome({ kind: "range" }),
        size: contracts(m.quantity).toFixed(2),
        price: perContract(usd, m.quantity),
        usdcSize: usd,
        timestamp: Math.floor(m.checkpoint_timestamp_ms / 1000),
        transactionHash: m.digest,
        ts: m.checkpoint_timestamp_ms,
      });
    }

    for (const r of rr) {
      if (r.trader !== owner && r.sender !== owner) continue;
      const usd = fromDusdcU64(r.payout);
      rows.push({
        key: r.event_digest || `${r.digest}:rr`,
        side: "SELL",
        type: "REDEEM",
        kind: "range",
        oracleId: r.oracle_id,
        title: positionTitle({
          oracleId: r.oracle_id,
          asset: assetById.get(r.oracle_id),
          expiry: r.expiry,
          kind: "range",
          lowerStrike: fromPriceU64(r.lower_strike),
          higherStrike: fromPriceU64(r.higher_strike),
          openQty: r.quantity,
          cost: 0,
          markValue: usd,
          unrealizedPnl: 0,
          realizedPnl: 0,
          status: "settled",
        }),
        outcome: positionOutcome({ kind: "range" }),
        size: contracts(r.quantity).toFixed(2),
        price: perContract(usd, r.quantity),
        usdcSize: usd,
        timestamp: Math.floor(r.checkpoint_timestamp_ms / 1000),
        transactionHash: r.digest,
        ts: r.checkpoint_timestamp_ms,
        settled: r.is_settled,
      });
    }

    rows.sort((a, b) => b.ts - a.ts);

    // Realized-cashflow P&L: walk events oldest→newest, BUYs subtract cost,
    // SELLs (redeems) add payout. The running total is the wallet's net realized
    // position relative to start — a truthful, server-derived P&L curve.
    const asc = [...rows].sort((a, b) => a.ts - b.ts);
    let cum = 0;
    const pnlHistory = asc.map((r) => {
      cum += r.side === "BUY" ? -r.usdcSize : r.usdcSize;
      return {
        ts: r.ts,
        time: new Date(r.ts).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        value: Number(cum.toFixed(4)),
      };
    });

    return NextResponse.json({ ok: true, activity: rows, pnlHistory });
  } catch (e) {
    return NextResponse.json({ ok: false, activity: [], pnlHistory: [], error: String(e) });
  }
}

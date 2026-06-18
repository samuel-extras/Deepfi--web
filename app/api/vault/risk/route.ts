import { NextResponse } from "next/server";
import {
  indexer,
  type SviLatestRow,
  type VaultSummary,
} from "@/lib/indexer";
import { fromDusdcU64, fromPriceU64 } from "@/lib/deepbook";
import { normalizeRawSvi, ivAcrossMoneyness } from "@/lib/svi";
import { sigmaMovePct } from "@/lib/risk/scenario";

export const revalidate = 10;

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function first<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v;
}

type PerfPoint = {
  timestamp_ms: number;
  share_price: number;
  vault_value?: number;
};

/**
 * GET /api/vault/risk — everything the PLP risk dashboard needs:
 *   - vault summary (TVL, share price, utilization, withdrawal limiter)
 *   - share-price history (APY + drawdown)
 *   - per-oracle exposure (the vault is short every open position)
 *   - open positions + spot + σ for the ±kσ stress simulator
 */
export async function GET() {
  try {
    const now = Date.now();
    const [summaryRaw, perfRaw, rows, posMint, rngMint] = await Promise.all([
      indexer.vaultSummary(),
      indexer.vaultPerformance().catch(() => ({ points: [] })),
      indexer.oracles(),
      indexer.positionsMinted(200).catch(() => []),
      indexer.rangesMinted(200).catch(() => []),
    ]);
    const summaryR = summaryRaw as VaultSummary;
    const perf = perfRaw as { points?: PerfPoint[] };

    const active = rows
      .filter((o) => o.status === "active" && o.expiry > now)
      .sort((a, b) => a.expiry - b.expiry);
    const activeIds = new Set(active.map((o) => o.oracle_id));
    const oMeta = new Map(active.map((o) => [o.oracle_id, o]));

    // spot (soonest) + a meaningful 1σ move (longest active horizon)
    let spot = 0;
    let sigma1Pct = 1;
    const soonest = active[0];
    const longest = active[active.length - 1];
    if (soonest) {
      const [price, lsvi] = await Promise.all([
        indexer.oraclePriceLatest(soonest.oracle_id).then(first).catch(() => null),
        indexer
          .oracleSviLatest((longest ?? soonest).oracle_id)
          .then(first<SviLatestRow>)
          .catch(() => null),
      ]);
      const fwd = price?.forward ?? price?.spot ?? price?.price;
      spot = fwd ? fromPriceU64(fwd) : fromPriceU64(soonest.min_strike) * 1.4;
      if (lsvi) {
        const o = longest ?? soonest;
        const p = normalizeRawSvi(lsvi as Required<SviLatestRow>);
        const t = Math.max(1e-6, (o.expiry - now) / MS_PER_YEAR);
        sigma1Pct = sigmaMovePct(ivAcrossMoneyness(p, t, [0])[0], t);
      }
    }

    // open positions on active oracles (vault is the short side)
    const openPositions: {
      kind: "binary" | "range";
      isUp?: boolean;
      strike?: number;
      lower?: number;
      higher?: number;
      weight: number;
    }[] = [];
    const perOracle = new Map<
      string,
      { openContracts: number; premium: number; count: number }
    >();
    const bump = (id: string, qty: number, cost: number) => {
      const a = perOracle.get(id) ?? { openContracts: 0, premium: 0, count: 0 };
      a.openContracts += qty;
      a.premium += cost;
      a.count += 1;
      perOracle.set(id, a);
    };
    for (const p of posMint) {
      if (!activeIds.has(p.oracle_id)) continue;
      const qty = Number(p.quantity) || 0;
      openPositions.push({
        kind: "binary",
        isUp: p.is_up,
        strike: fromPriceU64(p.strike),
        weight: qty,
      });
      bump(p.oracle_id, qty, fromDusdcU64(p.cost));
    }
    for (const r of rngMint) {
      if (!activeIds.has(r.oracle_id)) continue;
      const qty = Number(r.quantity) || 0;
      openPositions.push({
        kind: "range",
        lower: fromPriceU64(r.lower_strike),
        higher: fromPriceU64(r.higher_strike),
        weight: qty,
      });
      bump(r.oracle_id, qty, fromDusdcU64(r.cost));
    }

    const exposure = [...perOracle.entries()]
      .map(([id, a]) => {
        const o = oMeta.get(id);
        return {
          oracleId: id,
          asset: o?.underlying_asset ?? "BTC",
          minutesToExpiry: o
            ? Math.max(1, Math.round((o.expiry - now) / 60000))
            : 0,
          openContracts: a.openContracts,
          premium: a.premium,
          positions: a.count,
        };
      })
      .sort((a, b) => a.minutesToExpiry - b.minutesToExpiry);

    const premium = exposure.reduce((s, e) => s + e.premium, 0);

    const summary = {
      tvl: fromDusdcU64(summaryR.vault_value),
      vaultBalance: fromDusdcU64(summaryR.vault_balance),
      sharePrice: summaryR.plp_share_price,
      utilization: summaryR.utilization,
      maxPayoutUtilization: summaryR.max_payout_utilization,
      availableWithdrawal: fromDusdcU64(summaryR.available_withdrawal),
      availableLiquidity: fromDusdcU64(summaryR.available_liquidity),
      totalMaxPayout: fromDusdcU64(summaryR.total_max_payout),
      totalMtm: fromDusdcU64(summaryR.total_mtm),
      plpTotalSupply: fromDusdcU64(summaryR.plp_total_supply),
    };

    // PLP share price accrues slowly; the indexer history has occasional glitch
    // points (e.g. a momentary 1.33 spike) that would poison the drawdown peak.
    // Reject anything more than ±15% off the median.
    const rawPts = (perf?.points ?? []).filter((p) => p.share_price > 0);
    const sortedSp = rawPts.map((p) => p.share_price).sort((a, b) => a - b);
    const median = sortedSp.length
      ? sortedSp[Math.floor(sortedSp.length / 2)]
      : 1;
    const points = rawPts
      .filter((p) => Math.abs(p.share_price / median - 1) < 0.006)
      .map((p) => ({
        t: p.timestamp_ms,
        sharePrice: p.share_price,
        vaultValue: p.vault_value != null ? fromDusdcU64(p.vault_value) : null,
      }));

    return NextResponse.json({
      ok: true,
      asOf: now,
      spot,
      sigma1Pct,
      premium,
      summary,
      exposure,
      openPositions,
      points,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}

"use client";

/**
 * DeepBook Predict terminal — the prediction page.
 *
 * One hero market at a time (soonest expiry by default, switchable on the
 * expiry rail), a live oracle chart with the selection's win zone painted on,
 * an order-book-style strike ladder, and a sticky order ticket. Activity,
 * the SVI smile, and the multi-leg ladder strategy live in tabs below the
 * chart so the first screen stays focused on one decision: where will BTC
 * settle, and how much do you want on it?
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import FundingBar from "@/components/wallet/FundingBar";
import SviSmileChart from "@/components/prediction/SviSmileChart";
import { OracleHeader } from "@/components/prediction/oracle/OracleHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import ExpiryRail from "./ExpiryRail";
import MarketHeader from "./MarketHeader";
import PriceChart from "./PriceChart";
import MarketTabs from "./MarketTabs";
import TradeTicket from "./TradeTicket";
import type {
  OracleDTO,
  OraclesResponse,
  PricesResponse,
  Selection,
  SviResponse,
} from "./types";
import { snapToTick, usd0, volStep } from "./types";
import { OracleRules } from "../oracle/OracleRules";
import { OracleFaq } from "../oracle/OracleFaq";
import { OracleDetail } from "@/lib/predict";

const RAIL_MAX = 9; // soonest expiries on the rail (3 inline pills + up to 6 in "More")

export type MirrorParams = {
  size: number | null;
  low: number | null;
  high: number | null;
};

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  return (await r.json()) as T;
}

export default function PredictTerminal({
  mirrorParams,
  oracleId,
  hideBrand = false,
  detail,
}: {
  mirrorParams?: MirrorParams;
  /** Preselect this oracle (from the /prediction/[oracleId] route param). */
  oracleId?: string;
  /** Hide the generic brand row (the per-oracle page supplies its own header). */
  hideBrand?: boolean;
  detail?: OracleDetail;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(oracleId ?? null);
  const [sel, setSel] = useState<Selection>({
    posType:
      mirrorParams?.size && mirrorParams.low !== mirrorParams.high
        ? "range"
        : "binary",
    direction: "up",
    strikeUsd: null,
    lowerUsd: null,
    higherUsd: null,
  });
  const [mirrorBanner, setMirrorBanner] = useState(true);
  const mirrorApplied = useRef(false);

  // ── data ──────────────────────────────────────────────────────────────────
  const oraclesQ = useQuery({
    queryKey: ["predict", "oracles"],
    queryFn: () => fetchJSON<OraclesResponse>("/api/oracles"),
    refetchInterval: 10_000,
  });
  const active = useMemo(() => oraclesQ.data?.active ?? [], [oraclesQ.data]);
  // a few recently-settled markets — selectable on the rail's "Past" dropdown,
  // shown read-only (historical chart, closed ticket).
  const settledOracles = useMemo(
    () => oraclesQ.data?.settled ?? [],
    [oraclesQ.data],
  );

  // rail: one chip per distinct expiry, soonest first, capped. The server lists
  // active oracles unsorted and can still include an already-expired one, so
  // drop anything past expiry and sort before slicing. "now" is sourced from the
  // query's fetch timestamp (a pure render value) and refreshes every refetch.
  const fetchedAt = oraclesQ.dataUpdatedAt;
  const railOracles = useMemo(() => {
    const seen = new Set<number>();
    const out: OracleDTO[] = [];
    const live = active
      .filter((o) => o.expiry > fetchedAt)
      .sort((a, b) => a.expiry - b.expiry);
    for (const o of live) {
      if (seen.has(o.expiry)) continue;
      seen.add(o.expiry);
      out.push(o);
      if (out.length >= RAIL_MAX) break;
    }
    return out;
  }, [active, fetchedAt]);

  const oracle: OracleDTO | null = useMemo(
    () =>
      active.find((o) => o.oracleId === selectedId) ??
      settledOracles.find((o) => o.oracleId === selectedId) ??
      railOracles[0] ??
      null,
    [active, settledOracles, railOracles, selectedId],
  );

  const sviQ = useQuery({
    queryKey: ["predict", "svi", oracle?.oracleId],
    queryFn: () =>
      fetchJSON<SviResponse>(
        oracle ? `/api/svi?oracleId=${oracle.oracleId}` : "/api/svi",
      ),
    enabled: !!oracle,
    refetchInterval: 10_000,
  });
  const svi = sviQ.data;

  const pricesQ = useQuery({
    queryKey: ["predict", "prices", oracle?.oracleId],
    queryFn: () =>
      fetchJSON<PricesResponse>(`/api/prices?oracleId=${oracle!.oracleId}`),
    enabled: !!oracle,
    refetchInterval: 3_000,
  });
  const points = useMemo(() => pricesQ.data?.points ?? [], [pricesQ.data]);
  const spot = pricesQ.data?.spot ?? null;

  // page header tracks the *selected* oracle so it follows rail changes (incl.
  // past markets). For the route's own oracle we keep the server `detail`, which
  // carries the richer settled / SVI fields.
  const headerDetail: OracleDetail | null = useMemo(() => {
    if (!oracle) return null;
    if (detail && detail.oracleId === oracle.oracleId) return detail;
    return {
      oracleId: oracle.oracleId,
      asset: oracle.asset,
      expiry: oracle.expiry,
      status: oracle.status,
      live: railOracles.some((o) => o.oracleId === oracle.oracleId),
      minStrike: oracle.minStrike,
      tickSize: oracle.tickSize,
      settlementPrice: oracle.settlementPrice,
      atmStrike: null,
      aboveProb: null,
      atmIv: svi?.atmIv ?? null,
      forward: svi?.forward ?? spot ?? null,
      activatedAt: null,
      settledAt: null,
    };
  }, [oracle, detail, railOracles, svi?.atmIv, svi?.forward, spot]);

  // ── selection lifecycle ───────────────────────────────────────────────────
  const tick = Math.max(oracle?.tickSize ?? 1, 1);
  const ref = svi?.forward ?? spot;
  const atm =
    oracle && ref != null ? snapToTick(ref, oracle.minStrike, tick) : null;
  // strike increments scale with the expected move at this expiry
  const step =
    oracle && ref != null
      ? volStep(ref, svi?.atmIv, oracle.expiry, tick)
      : tick;

  // switching markets resets strikes to that market's ATM defaults
  const prevOracleId = useRef<string | null>(null);
  useEffect(() => {
    if (!oracle) return;
    if (prevOracleId.current && prevOracleId.current !== oracle.oracleId) {
      setSel((s) => ({
        ...s,
        strikeUsd: null,
        lowerUsd: null,
        higherUsd: null,
      }));
    }
    prevOracleId.current = oracle.oracleId;
  }, [oracle]);

  // auto-advance: the instant the active market expires, roll the selection
  // forward to the next soonest live oracle so the page never sits on a dead
  // market (don't wait for the 10s refetch). Skipped when the user is viewing a
  // settled market on purpose — leave them there.
  useEffect(() => {
    if (!oracle) return;
    if (settledOracles.some((o) => o.oracleId === oracle.oracleId)) return;
    const advance = () => {
      const next = railOracles.find(
        (o) => o.oracleId !== oracle.oracleId && o.expiry > Date.now(),
      );
      if (next) setSelectedId(next.oracleId);
    };
    const msLeft = oracle.expiry - Date.now();
    if (msLeft <= 0) {
      advance();
      return;
    }
    const id = setTimeout(advance, msLeft + 200);
    return () => clearTimeout(id);
  }, [oracle, railOracles, settledOracles]);

  // fill empty strikes once the grid is known (and apply a mirror link once)
  useEffect(() => {
    if (!oracle || atm == null) return;

    if (
      !mirrorApplied.current &&
      mirrorParams?.size &&
      mirrorParams.low != null
    ) {
      mirrorApplied.current = true;
      const lo = snapToTick(mirrorParams.low, oracle.minStrike, tick);
      const hi =
        mirrorParams.high != null
          ? snapToTick(mirrorParams.high, oracle.minStrike, tick)
          : lo;
      if (hi > lo) {
        setSel({
          posType: "range",
          direction: "up",
          strikeUsd: atm,
          lowerUsd: lo,
          higherUsd: hi,
        });
      } else {
        setSel({
          posType: "binary",
          direction: "up",
          strikeUsd: lo,
          lowerUsd: atm - step,
          higherUsd: atm + step,
        });
      }
      return;
    }

    setSel((s) => ({
      ...s,
      strikeUsd: s.strikeUsd ?? atm,
      lowerUsd: s.lowerUsd ?? Math.max(oracle.minStrike, atm - step),
      higherUsd: s.higherUsd ?? atm + step,
    }));
  }, [oracle, atm, tick, step, mirrorParams]);

  const patchSel = (patch: Partial<Selection>) =>
    setSel((s) => ({ ...s, ...patch }));

  const serverOk = oraclesQ.isSuccess && oraclesQ.data?.ok;

  // ── empty / loading states ────────────────────────────────────────────────
  if (oraclesQ.isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-white/[0.04]" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          <div className="h-[420px] animate-pulse rounded-xl bg-white/[0.03]" />
          <div className="h-[420px] animate-pulse rounded-xl bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  if (!oracle) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        {!hideBrand && <BrandRow serverOk={!!serverOk} count={0} />}
        <div className="mt-6 rounded-xl border border-white/5 bg-[#16181D] p-12 text-center">
          <div className="text-3xl">🌙</div>
          <h2 className="mt-3 text-base font-bold text-white">
            Between expiries
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#6B7280]">
            No oracle is live right now. Rolling sub-hour BTC markets reopen
            every cycle — this page refreshes automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-360 px-4 py-5 xl:px-14">
      {!hideBrand && <BrandRow serverOk={!!serverOk} count={active.length} />}

      {/* mirror banner */}
      {mirrorParams?.size && mirrorBanner ? (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-[#02DA8B]/25 bg-[#02DA8B]/[0.05] px-4 py-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[#02DA8B]">↻</span>
            <span className="font-bold text-white">Mirroring trade</span>
            <span className="text-[#A9A9A9]">
              {mirrorParams.low != null &&
              mirrorParams.high != null &&
              mirrorParams.low !== mirrorParams.high
                ? `${usd0(mirrorParams.low)} – ${usd0(mirrorParams.high)}`
                : mirrorParams.low != null
                  ? `@ ${usd0(mirrorParams.low)}`
                  : ""}
              {" · "}
              <span className="font-mono text-[#02DA8B]">
                ${mirrorParams.size}
              </span>
            </span>
          </div>
          <button
            onClick={() => setMirrorBanner(false)}
            className="cursor-pointer text-[#6B7280] transition-colors hover:text-white"
            aria-label="dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:gap-12 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── left: market ── */}
        <div className="min-w-0 space-y-4">
          {detail && headerDetail && <OracleHeader detail={headerDetail} />}
          {/* chart switch (BTC price / vol surface) shares the expiry-rail row
              so it costs no extra vertical space */}
          <Tabs defaultValue="price">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <ExpiryRail
                  oracles={railOracles}
                  pastOracles={settledOracles}
                  selectedId={oracle.oracleId}
                  onSelect={(o) => setSelectedId(o.oracleId)}
                />
              </div>
              <TabsList className="shrink-0 rounded-full">
                <TabsTrigger
                  className="text-xs rounded-full data-active:bg-background data-active:text-foreground dark:data-active:border-transparent dark:data-active:bg-background dark:data-active:text-foreground"
                  value="price"
                >
                  BTC Price
                </TabsTrigger>
                <TabsTrigger
                  className="text-xs rounded-full data-active:bg-background data-active:text-foreground dark:data-active:border-transparent dark:data-active:bg-background dark:data-active:text-foreground"
                  value="smile"
                >
                  Vol Surface
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/5">
              {/* stats strip (strike · spot · vol · countdown) — padded, while
                  the chart below runs full-bleed to fill the card width */}
              <div className="px-4 pt-4">
                <MarketHeader
                  oracle={oracle}
                  points={points}
                  sel={sel}
                  atmIv={svi?.atmIv}
                />
              </div>

              <TabsContent value="price" className="pt-3 pb-3">
                <PriceChart points={points} expiry={oracle.expiry} sel={sel} />
              </TabsContent>

              <TabsContent value="smile" className="p-4">
                {svi?.points?.length ? (
                  <>
                    <SviSmileChart
                      points={svi.points}
                      forward={svi.forward}
                      lowerStrike={
                        sel.posType === "range"
                          ? (sel.lowerUsd ?? undefined)
                          : (sel.strikeUsd ?? undefined)
                      }
                      higherStrike={
                        sel.posType === "range"
                          ? (sel.higherUsd ?? undefined)
                          : undefined
                      }
                      height={300}
                    />
                    <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                      Implied volatility by strike from the on-chain SVI
                      surface. Every price on this page derives from these five
                      parameters — strikes on the high wings cost more because
                      the market prices bigger moves there.
                    </p>
                  </>
                ) : (
                  <div className="flex h-75 items-center justify-center text-sm text-muted-foreground">
                    Loading the vol surface…
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>

          <MarketTabs
            oracle={oracle}
            spot={spot}
            svi={svi}
            sel={sel}
            step={step}
            onSelectBinary={(strikeUsd, direction) =>
              patchSel({ posType: "binary", strikeUsd, direction })
            }
            onSelectRange={(lowerUsd, higherUsd) =>
              patchSel({ posType: "range", lowerUsd, higherUsd })
            }
          />
          {detail && <OracleRules detail={detail} />}
          {detail && <OracleFaq detail={detail} />}
        </div>

        {/* ── right: ticket ── */}
        <div className="space-y-4 lg:sticky lg:top-16">
          <TradeTicket
            oracle={oracle}
            svi={svi}
            sel={sel}
            step={step}
            onSelChange={patchSel}
            initialAmount={
              mirrorParams?.size ? String(mirrorParams.size) : undefined
            }
          />
          <FundingBar />
        </div>
      </div>

      <p className="mt-8 text-center text-[11px] text-[#6B7280]">
        Not financial advice · Testnet only · Prices derive from the on-chain
        SVI volatility surface
      </p>
    </div>
  );
}

function BrandRow({ serverOk, count }: { serverOk: boolean; count: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="text-xl font-bold text-white">Predict</h1>
        <p className="mt-0.5 text-xs text-[#6B7280]">
          Vol-surface-priced BTC binaries &amp; ranges · settles on-chain
        </p>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            serverOk ? "bg-[#02DA8B]" : "bg-amber-400"
          } ${serverOk ? "animate-pulse" : ""}`}
        />
        predict-server.testnet · {count} live market{count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

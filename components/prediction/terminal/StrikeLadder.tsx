"use client";

/**
 * Order-book-style strike ladder.
 *
 * Binary mode: strikes around ATM, "Above ¢ / Below ¢" buttons per row, with a
 * live spot divider where price currently sits. Range mode: preset bands.
 *
 * Prices come from ONE batched devInspect — every ladder row priced by the
 * actual on-chain `get_trade_amounts` in a single RPC; SVI fair value ("~")
 * fills in while loading or if the read fails.
 */
import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { OBJECTS, TARGETS, toStrikeU64 } from "@/lib/deepbook";
import { ivFromRawSvi, probInRange } from "@/lib/svi";
import type { Direction, OracleDTO, Selection, SviResponse } from "./types";
import { snapToTick, usd0, usd2 } from "./types";
import { Button } from "@/components/ui/button";

const Q0 = 1_000_000;
const ZERO_SENDER = "0x" + "0".repeat(64);
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
const LADDER_HALF = 3; // strikes each side of ATM

// ─── batched on-chain quotes ──────────────────────────────────────────────────
type LadderQuotes = Map<string, number>; // `${strike}:up` → ask per contract

function useBinaryLadderQuotes(
  oracle: OracleDTO | null,
  strikes: number[],
): LadderQuotes | null {
  const client = useSuiClient();
  const live =
    !!oracle && oracle.status === "active" && oracle.expiry > Date.now();
  const q = useQuery({
    queryKey: ["predict", "ladder", oracle?.oracleId, strikes.join("|")],
    enabled: live && strikes.length > 0,
    refetchInterval: 8_000,
    staleTime: 6_000,
    placeholderData: keepPreviousData,
    retry: 1,
    queryFn: async () => {
      if (!oracle) return null;
      const tx = new Transaction();
      const legs: { strike: number; dir: Direction }[] = [];
      for (const strike of strikes) {
        for (const dir of ["up", "down"] as Direction[]) {
          const key = tx.moveCall({
            target: dir === "up" ? TARGETS.marketKeyUp : TARGETS.marketKeyDown,
            arguments: [
              tx.pure.id(oracle.oracleId),
              tx.pure.u64(oracle.expiry),
              tx.pure.u64(toStrikeU64(strike)),
            ],
          });
          tx.moveCall({
            target: TARGETS.getTradeAmounts,
            arguments: [
              tx.object(OBJECTS.predict),
              tx.object(oracle.oracleId),
              key,
              tx.pure.u64(Q0),
              tx.object(OBJECTS.clock),
            ],
          });
          legs.push({ strike, dir });
        }
      }
      const res = await client.devInspectTransactionBlock({
        sender: ZERO_SENDER,
        transactionBlock: tx,
      });
      if (!res.results) return null;
      const out: LadderQuotes = new Map();
      // commands alternate key-construction / get_trade_amounts
      legs.forEach((leg, i) => {
        const rv = res.results?.[i * 2 + 1]?.returnValues;
        if (rv && rv.length >= 1) {
          const cost = Number(bcs.U64.parse(Uint8Array.from(rv[0][0])));
          out.set(`${leg.strike}:${leg.dir}`, cost / Q0);
        }
      });
      return out;
    },
  });
  return q.data ?? null;
}

function useRangeLadderQuotes(
  oracle: OracleDTO | null,
  bands: [number, number][],
): LadderQuotes | null {
  const client = useSuiClient();
  const live =
    !!oracle && oracle.status === "active" && oracle.expiry > Date.now();
  const q = useQuery({
    queryKey: [
      "predict",
      "ladder-range",
      oracle?.oracleId,
      bands.map((b) => b.join("-")).join("|"),
    ],
    enabled: live && bands.length > 0,
    refetchInterval: 8_000,
    staleTime: 6_000,
    placeholderData: keepPreviousData,
    retry: 1,
    queryFn: async () => {
      if (!oracle) return null;
      const tx = new Transaction();
      for (const [lo, hi] of bands) {
        const key = tx.moveCall({
          target: TARGETS.rangeKeyNew,
          arguments: [
            tx.pure.id(oracle.oracleId),
            tx.pure.u64(oracle.expiry),
            tx.pure.u64(toStrikeU64(lo)),
            tx.pure.u64(toStrikeU64(hi)),
          ],
        });
        tx.moveCall({
          target: TARGETS.getRangeTradeAmounts,
          arguments: [
            tx.object(OBJECTS.predict),
            tx.object(oracle.oracleId),
            key,
            tx.pure.u64(Q0),
            tx.object(OBJECTS.clock),
          ],
        });
      }
      const res = await client.devInspectTransactionBlock({
        sender: ZERO_SENDER,
        transactionBlock: tx,
      });
      if (!res.results) return null;
      const out: LadderQuotes = new Map();
      bands.forEach(([lo, hi], i) => {
        const rv = res.results?.[i * 2 + 1]?.returnValues;
        if (rv && rv.length >= 1) {
          const cost = Number(bcs.U64.parse(Uint8Array.from(rv[0][0])));
          out.set(`${lo}-${hi}`, cost / Q0);
        }
      });
      return out;
    },
  });
  return q.data ?? null;
}

// ─── pieces ───────────────────────────────────────────────────────────────────
function PriceBtn({
  label,
  price,
  est,
  tone,
  selected,
  onClick,
}: {
  label: string;
  price: number | null;
  est: boolean;
  tone: "up" | "down";
  selected: boolean;
  onClick: () => void;
}) {
  const base =
    "min-w-[88px] cursor-pointer rounded-full border px-2.5 py-1.5 text-xs font-bold tabular-nums transition-all duration-150";
  const palette =
    tone === "up"
      ? selected
        ? "border-[#02DA8B] bg-[#02DA8B] text-[#081A12] shadow-[0_0_12px_rgba(2,218,139,0.25)]"
        : "border-[#02DA8B]/25 bg-[#02DA8B]/10 text-[#02DA8B] hover:bg-[#02DA8B]/20"
      : selected
        ? "border-[#EF4444] bg-[#EF4444] text-white shadow-[0_0_12px_rgba(239,68,68,0.25)] hover:bg-[#EF4444]"
        : "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20";
  return (
    <Button onClick={onClick} className={`${base} ${palette}`}>
      {label}{" "}
      {price != null ? `${est ? "~" : ""}${Math.round(price * 100)}¢` : "—"}
    </Button>
  );
}

/**
 * Compact price cell for the narrow "book panel" layout — just the ¢ price,
 * colour-coded and clickable, no Above/Below button chrome so the ladder fits a
 * thin column without horizontal overflow.
 */
function PriceCell({
  price,
  est,
  tone,
  selected,
  onClick,
}: {
  price: number | null;
  est: boolean;
  tone: "up" | "down";
  selected: boolean;
  onClick: () => void;
}) {
  const palette =
    tone === "up"
      ? selected
        ? "bg-[#02DA8B] text-[#081A12]"
        : "text-[#02DA8B] hover:bg-[#02DA8B]/15"
      : selected
        ? "bg-[#EF4444] text-white"
        : "text-[#FF5C5C] hover:bg-[#EF4444]/15";
  return (
    <button
      onClick={onClick}
      className={`min-w-[46px] cursor-pointer rounded px-1.5 py-1 text-right text-xs font-bold tabular-nums transition-colors ${palette}`}
    >
      {price != null ? `${est ? "~" : ""}${Math.round(price * 100)}¢` : "—"}
    </button>
  );
}

function SpotDivider({ spot }: { spot: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5">
      <div className="h-px flex-1 bg-[#02DA8B]/30" />
      <span className="font-mono text-[10px] font-semibold text-[#02DA8B] tabular-nums">
        {usd2(spot)}
      </span>
      <div className="h-px flex-1 bg-[#02DA8B]/30" />
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────
export default function StrikeLadder({
  oracle,
  spot,
  svi,
  sel,
  step,
  onSelectBinary,
  onSelectRange,
  bare = false,
  compact = false,
}: {
  oracle: OracleDTO;
  spot: number | null;
  svi?: SviResponse;
  sel: Selection;
  /** vol-scaled rung spacing (multiple of the on-chain tick) */
  step: number;
  onSelectBinary: (strikeUsd: number, dir: Direction) => void;
  onSelectRange: (lowerUsd: number, higherUsd: number) => void;
  /** drop the outer card chrome when hosted inside the market tabs */
  bare?: boolean;
  /** narrow "book panel" layout: ¢-price cells instead of Above/Below buttons */
  compact?: boolean;
}) {
  const tick = Math.max(oracle.tickSize, 1);
  const ref = svi?.forward ?? spot ?? null;
  const atm = ref != null ? snapToTick(ref, oracle.minStrike, tick) : null;
  const tYears = Math.max(1e-9, (oracle.expiry - Date.now()) / MS_PER_YEAR);

  const strikes = useMemo(() => {
    if (atm == null) return [];
    const out: number[] = [];
    for (let i = LADDER_HALF; i >= -LADDER_HALF; i--) out.push(atm + i * step);
    return out.filter((s) => s >= oracle.minStrike);
  }, [atm, step, oracle.minStrike]);

  const bands = useMemo<[number, number][]>(() => {
    if (atm == null) return [];
    const all: [number, number][] = [
      [atm - step, atm + step],
      [atm - 2 * step, atm + 2 * step],
      [atm - 3 * step, atm + 3 * step],
      [atm, atm + 2 * step],
      [atm - 2 * step, atm],
    ];
    return all.filter(([lo]) => lo >= oracle.minStrike);
  }, [atm, step, oracle.minStrike]);

  const binaryQuotes = useBinaryLadderQuotes(
    sel.posType === "binary" ? oracle : null,
    strikes,
  );
  const rangeQuotes = useRangeLadderQuotes(
    sel.posType === "range" ? oracle : null,
    bands,
  );

  const pUp = (strike: number): number | null => {
    if (!svi?.params || !svi.forward) return null;
    const iv = ivFromRawSvi(strike, svi.forward, svi.params, tYears);
    return probInRange(svi.forward, strike, Infinity, iv, tYears);
  };
  const pBand = (lo: number, hi: number): number | null => {
    if (!svi?.params || !svi.forward) return null;
    const iv = ivFromRawSvi((lo + hi) / 2, svi.forward, svi.params, tYears);
    return probInRange(svi.forward, lo, hi, iv, tYears);
  };

  if (atm == null) {
    return (
      <div
        className={`h-48 animate-pulse bg-white/[0.02] ${
          bare ? "" : "rounded-xl border border-white/5"
        }`}
      />
    );
  }

  return (
    <div
      className={
        bare
          ? ""
          : "overflow-hidden rounded-xl border border-white/5 bg-[#16181D]"
      }
    >
      <div
        className={`flex items-center justify-between border-b border-white/5 py-2.5 ${
          compact ? "px-2.5" : "px-4"
        }`}
      >
        <span className="text-xs font-bold text-white">
          {sel.posType === "binary" ? "Strike ladder" : "Range bands"}
        </span>
        <span className="text-[10px] text-[#6B7280]">
          {compact ? (
            <>rung {usd0(step)}</>
          ) : (
            <>
              {binaryQuotes || rangeQuotes
                ? "live on-chain quotes"
                : "~ SVI fair value"}
              {" · "}rung {usd0(step)} · tick {usd0(tick)}
            </>
          )}
        </span>
      </div>

      {/* compact column labels (binary): the two ¢ cells are Above / Below */}
      {compact && sel.posType === "binary" ? (
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-white/5 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#6B7280]">
          <span>Strike</span>
          <span className="min-w-[46px] text-right text-[#02DA8B]/80">Above</span>
          <span className="min-w-[46px] text-right text-[#FF5C5C]/80">Below</span>
        </div>
      ) : null}

      {sel.posType === "binary" ? (
        <div className="divide-y divide-white/[0.04]">
          {strikes.map((strike, i) => {
            const prob = pUp(strike);
            const chainUp = binaryQuotes?.get(`${strike}:up`) ?? null;
            const chainDn = binaryQuotes?.get(`${strike}:down`) ?? null;
            const upPrice = chainUp ?? prob;
            const dnPrice = chainDn ?? (prob != null ? 1 - prob : null);
            const isSel = sel.strikeUsd === strike;
            const showSpotAfter =
              spot != null &&
              spot < strike &&
              (i === strikes.length - 1 || spot >= strikes[i + 1]);
            return (
              <div key={strike}>
                <div
                  className={`relative grid grid-cols-[1fr_auto_auto] items-center gap-2 transition-colors ${
                    compact ? "px-2.5 py-1.5" : "px-4 py-2"
                  } ${isSel ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"}`}
                >
                  {/* probability wash */}
                  {prob != null ? (
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-[#02DA8B]/[0.07] to-transparent"
                      style={{ width: `${prob * 100}%` }}
                    />
                  ) : null}
                  <div className="relative flex min-w-0 items-baseline gap-1.5">
                    <span className="font-mono text-sm font-semibold text-white tabular-nums">
                      {usd0(strike)}
                    </span>
                    {strike === atm ? (
                      <span className="rounded bg-white/10 px-1 py-px text-[9px] font-bold text-[#A9A9A9]">
                        ATM
                      </span>
                    ) : null}
                    {!compact && spot != null ? (
                      <span
                        className={`font-mono text-[10px] tabular-nums ${
                          strike >= spot
                            ? "text-[#02DA8B]/70"
                            : "text-[#FF5C5C]/70"
                        }`}
                      >
                        {strike >= spot ? "+" : ""}
                        {usd0(strike - spot).replace("$-", "-$")}
                      </span>
                    ) : null}
                  </div>
                  {compact ? (
                    <>
                      <PriceCell
                        price={upPrice}
                        est={chainUp == null}
                        tone="up"
                        selected={isSel && sel.direction === "up"}
                        onClick={() => onSelectBinary(strike, "up")}
                      />
                      <PriceCell
                        price={dnPrice}
                        est={chainDn == null}
                        tone="down"
                        selected={isSel && sel.direction === "down"}
                        onClick={() => onSelectBinary(strike, "down")}
                      />
                    </>
                  ) : (
                    <>
                      <PriceBtn
                        label="Above"
                        price={upPrice}
                        est={chainUp == null}
                        tone="up"
                        selected={isSel && sel.direction === "up"}
                        onClick={() => onSelectBinary(strike, "up")}
                      />
                      <PriceBtn
                        label="Below"
                        price={dnPrice}
                        est={chainDn == null}
                        tone="down"
                        selected={isSel && sel.direction === "down"}
                        onClick={() => onSelectBinary(strike, "down")}
                      />
                    </>
                  )}
                </div>
                {showSpotAfter ? <SpotDivider spot={spot} /> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {bands.map(([lo, hi]) => {
            const prob = pBand(lo, hi);
            const chain = rangeQuotes?.get(`${lo}-${hi}`) ?? null;
            const price = chain ?? prob;
            const isSel = sel.lowerUsd === lo && sel.higherUsd === hi;
            return (
              <div
                key={`${lo}-${hi}`}
                className={`relative grid grid-cols-[1fr_auto] items-center gap-2 transition-colors ${
                  compact ? "px-2.5 py-1.5" : "px-4 py-2"
                } ${isSel ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"}`}
              >
                {prob != null ? (
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-[#02DA8B]/[0.07] to-transparent"
                    style={{ width: `${prob * 100}%` }}
                  />
                ) : null}
                <div className="relative flex min-w-0 items-baseline gap-1.5">
                  <span className="font-mono text-xs font-semibold text-white tabular-nums">
                    {usd0(lo)} – {usd0(hi)}
                  </span>
                  {!compact ? (
                    <span className="text-[10px] text-[#6B7280]">
                      {usd0(hi - lo)} wide
                      {lo + hi === 2 * atm ? " · centered" : ""}
                    </span>
                  ) : null}
                </div>
                {compact ? (
                  <PriceCell
                    price={price}
                    est={chain == null}
                    tone="up"
                    selected={isSel}
                    onClick={() => onSelectRange(lo, hi)}
                  />
                ) : (
                  <PriceBtn
                    label="In range"
                    price={price}
                    est={chain == null}
                    tone="up"
                    selected={isSel}
                    onClick={() => onSelectRange(lo, hi)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

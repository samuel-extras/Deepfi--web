"use client";

/**
 * Margin order ticket — dex perp-panel styling (Long/Short segmented pills,
 * % slider, order-type pill) over the DeepBook margin hooks. Orders spend the
 * margin account's funds (own collateral + borrowed); borrowing itself lives
 * in the Position tab below, like a perp venue's margin controls.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useMemo, useState } from "react";
import { ConnectWalletDialog } from "@/components/wallet/ConnectWalletDialog";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { decimalsOf, formatAmount, quantizeDown } from "@/lib/sui/deepbookSpot";
import {
  getMarginPoolMeta,
  liquidationPrice,
  maxAdditionalBorrowQuote,
  maxBorrowAtLeverage,
  maxLeverage,
  type MarginPosition,
} from "@/lib/sui/deepbookMargin";
import MarginHeaderControls from "./MarginHeaderControls";
import MaxSlippageControl from "@/components/spot/Ticket/MaxSlippageControl";
import PriceField from "@/components/spot/Ticket/PriceField";
import SizeField from "@/components/spot/Ticket/SizeField";
import TimeInForce from "@/components/spot/Ticket/TimeInForce";
import { marginOrderFormSchema, fieldIssue } from "./marginOrderSchema";
import { usePoolParams, useWalletBalances } from "@/hooks/useDeepBookSpot";
import {
  useMarginActions,
  useMarginManager,
  useMarginSnapshot,
  useRiskParams,
} from "@/hooks/useDeepBookMargin";
import type { TerminalPrefill } from "@/components/spot/Ticket/types";

const FEE_BUFFER = 0.02;

type OrderType = "limit" | "market";

export default function MarginTicket({
  poolKey,
  midPrice,
  prefill,
}: {
  poolKey: string;
  midPrice: number | null;
  prefill: TerminalPrefill;
}) {
  const pool = getMarginPoolMeta(poolKey);
  const address = useActiveAccount()?.address;
  const {
    managerId,
    isLoading: managerLoading,
    create,
    isCreating,
  } = useMarginManager(poolKey);
  const { data: params } = usePoolParams(poolKey);
  const { data: snap } = useMarginSnapshot(poolKey);
  const { data: risk } = useRiskParams(poolKey);
  const { data: walletBal } = useWalletBalances();
  const { placeOrder, isPending, status } = useMarginActions(poolKey);

  const [side, setSide] = useState<"long" | "short">("long");
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [sizeUnit, setSizeUnit] = useState<string>(pool.base);
  const [sizePercent, setSizePercent] = useState(0);
  const [leverage, setLeverage] = useState(2);
  const [slippage, setSlippage] = useState(0.5);
  const [tradingMode, setTradingMode] = useState<
    "normal" | "borrow" | "borrowOnly"
  >("borrow");
  const [autoDeposit, setAutoDeposit] = useState<"off" | "single" | "both">(
    "single",
  );
  const [tif, setTif] = useState<"GTC" | "IOC" | "FOK">("GTC");
  const [postOnly, setPostOnly] = useState(false);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpslOn, setTpslOn] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [tpVal, setTpVal] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [slVal, setSlVal] = useState("");
  const [tpUnit, setTpUnit] = useState<"pct" | "usd">("pct");
  const [slUnit, setSlUnit] = useState<"pct" | "usd">("pct");
  const [touched, setTouched] = useState(false);

  const tick = params?.tickSize ?? 0;
  const lot = params?.lotSize ?? 0;
  const minSize = params?.minSize ?? 0;
  const priceDp = decimalsOf(tick);
  const qtyDp = decimalsOf(lot);

  const [seenPrefillNonce, setSeenPrefillNonce] = useState(0);
  if (prefill && prefill.nonce !== seenPrefillNonce) {
    setSeenPrefillNonce(prefill.nonce);
    setPrice(prefill.price.toFixed(priceDp));
    setOrderType("limit");
    setTouched(true);
  }
  const [prevPool, setPrevPool] = useState(poolKey);
  if (poolKey !== prevPool) {
    setPrevPool(poolKey);
    setPrice("");
    setSize("");
    setSizePercent(0);
    setSizeUnit(getMarginPoolMeta(poolKey).base);
    setTouched(false);
  }

  const isBid = side === "long";
  const priceNum = parseFloat(price) || 0;
  const effPrice = orderType === "limit" ? priceNum : (midPrice ?? 0);
  const sizeNum = parseFloat(size) || 0;
  const qty =
    sizeUnit === pool.base ? sizeNum : effPrice > 0 ? sizeNum / effPrice : 0;
  const orderValue = qty * effPrice;

  const feeBuffer = params?.whitelisted ? 0 : FEE_BUFFER;
  const needCoin = isBid ? pool.quote : pool.base;
  const needAmt = isBid ? orderValue * (1 + feeBuffer) : qty;
  const available = isBid
    ? (snap?.balances.quote ?? 0)
    : (snap?.balances.base ?? 0);

  // reduce-only is placeable only when debt EXCEEDS assets on a side
  // (i.e. the borrow has been spent into a position) — protocol predicate
  const hasBaseDebt = (snap?.baseDebt ?? 0) > (snap?.baseAsset ?? 0) + 1e-9;
  const hasQuoteDebt = (snap?.quoteDebt ?? 0) > (snap?.quoteAsset ?? 0) + 1e-9;
  const hasDebt = hasBaseDebt || hasQuoteDebt;
  // base shortfall is reduced by BUYING base; quote shortfall by SELLING base
  const reduceSideOk = hasBaseDebt ? isBid : hasQuoteDebt ? !isBid : false;

  const pos: MarginPosition = {
    baseAsset: snap?.baseAsset ?? 0,
    quoteAsset: snap?.quoteAsset ?? 0,
    baseDebt: snap?.baseDebt ?? 0,
    quoteDebt: snap?.quoteDebt ?? 0,
  };
  const oraclePrice = snap?.currentPrice ?? midPrice ?? 0;
  const maxLev = risk ? Math.floor(maxLeverage(risk.minBorrow)) : 5;
  const borrowableQuote = risk
    ? maxAdditionalBorrowQuote(pos, oraclePrice, risk.minBorrow)
    : 0;

  // ── trading mode + auto-deposit funding waterfall ─────────────────────
  // longs borrow quote; shorts borrow base. One loan side at a time.
  const anyBaseDebt = (snap?.baseDebt ?? 0) > 1e-9;
  const anyQuoteDebt = (snap?.quoteDebt ?? 0) > 1e-9;
  const borrowBlocked = (isBid && anyBaseDebt) || (!isBid && anyQuoteDebt);
  const canBorrow = tradingMode !== "normal" && !borrowBlocked && !reduceOnly;

  const gasAdj = (coin: string, v: number) =>
    coin === "SUI" ? Math.max(0, v - 0.3) : v;
  const walletNeed = gasAdj(needCoin, walletBal?.[needCoin] ?? 0);
  const otherCoin = isBid ? pool.base : pool.quote;
  const walletOther = gasAdj(otherCoin, walletBal?.[otherCoin] ?? 0);
  const depositCapNeed = autoDeposit === "off" ? 0 : walletNeed;
  // "Both": the other asset can also be deposited as collateral, which
  // raises borrow capacity by (L−1)× its value
  const otherDepositCap =
    autoDeposit === "both" && canBorrow && leverage > 1 ? walletOther : 0;

  const borrowCapQuote = canBorrow
    ? Math.min(
        maxBorrowAtLeverage(pos, oraclePrice, leverage) +
          (leverage - 1) *
            (isBid ? otherDepositCap * oraclePrice : otherDepositCap),
        borrowableQuote +
          (leverage - 1) *
            (isBid ? otherDepositCap * oraclePrice : otherDepositCap),
      )
    : 0;
  const borrowCap = isBid
    ? borrowCapQuote
    : effPrice > 0
      ? borrowCapQuote / effPrice
      : 0; // in needCoin units
  const spendable = available + depositCapNeed + borrowCap;

  const setQtyFields = (newQty: number, pct?: number) => {
    const q = quantizeDown(Math.max(0, newQty), lot || 1e-9);
    setSize(
      sizeUnit === pool.base
        ? q > 0
          ? q.toFixed(qtyDp)
          : ""
        : q * effPrice > 0
          ? (q * effPrice).toFixed(2)
          : "",
    );
    if (pct !== undefined) setSizePercent(pct);
  };

  const handlePercent = (pct: number) => {
    setTouched(true);
    if (!effPrice && isBid) {
      setSizePercent(pct);
      return;
    }
    // sizing draws on account funds + auto-borrow capacity at the leverage
    const maxQty = isBid ? spendable / (effPrice * (1 + feeBuffer)) : spendable;
    setQtyFields((maxQty * pct) / 100, pct);
  };

  const handleUnitChange = (unit: string) => {
    if (unit === sizeUnit) return;
    const v = parseFloat(size) || 0;
    if (unit === pool.quote)
      setSize(v > 0 && effPrice > 0 ? (v * effPrice).toFixed(2) : "");
    else
      setSize(
        v > 0 && effPrice > 0
          ? quantizeDown(v / effPrice, lot || 1e-9).toFixed(qtyDp)
          : "",
      );
    setSizeUnit(unit);
  };

  const onPriceChange = (v: string) => {
    setPrice(v);
    setTouched(true);
  };
  const onApplyMid = () => {
    if (midPrice == null) return;
    setPrice(quantizeDown(midPrice, tick || 1e-9).toFixed(priceDp));
    setTouched(true);
  };
  const onSizeChange = (v: string) => {
    setSize(v);
    setTouched(true);
    setSizePercent(0);
  };
  const onSelectTif = (t: "GTC" | "IOC" | "FOK") => {
    setTif(t);
    if (t !== "GTC") setPostOnly(false);
  };

  const mark = midPrice ?? oraclePrice;
  // TP/SL: the trigger Price and the Gain/Loss (% move or $ price-move from the
  // entry reference) are two-way linked — editing one fills in the other.
  const entryRef = orderType === "limit" ? priceNum || mark : mark;
  const trimNum = (n: number, dp: number) =>
    Number.isFinite(n) ? String(parseFloat(n.toFixed(dp))) : "";
  // Favorable side: a TP gains when isTp === isBid (long TP above entry / short
  // TP below); an SL loses on the opposite side.
  const priceToVal = (priceStr: string, isTp: boolean, unit: "pct" | "usd") => {
    const price = parseFloat(priceStr);
    if (!price || entryRef <= 0) return "";
    const sign = isTp === isBid ? 1 : -1;
    return unit === "pct"
      ? trimNum(sign * (price / entryRef - 1) * 100, 2)
      : trimNum(sign * (price - entryRef), priceDp);
  };
  const valToPrice = (valStr: string, isTp: boolean, unit: "pct" | "usd") => {
    const v = parseFloat(valStr);
    if (!v || entryRef <= 0) return "";
    const sign = isTp === isBid ? 1 : -1;
    const price =
      unit === "pct" ? entryRef * (1 + (sign * v) / 100) : entryRef + sign * v;
    return price > 0 ? trimNum(price, priceDp) : "";
  };
  const onTpPrice = (v: string) => {
    setTpPrice(v);
    setTpVal(priceToVal(v, true, tpUnit));
    setTouched(true);
  };
  const onTpVal = (v: string) => {
    setTpVal(v);
    setTpPrice(valToPrice(v, true, tpUnit));
    setTouched(true);
  };
  const onTpUnit = (u: "pct" | "usd") => {
    setTpUnit(u);
    setTpVal(priceToVal(tpPrice, true, u));
  };
  const onSlPrice = (v: string) => {
    setSlPrice(v);
    setSlVal(priceToVal(v, false, slUnit));
    setTouched(true);
  };
  const onSlVal = (v: string) => {
    setSlVal(v);
    setSlPrice(valToPrice(v, false, slUnit));
    setTouched(true);
  };
  const onSlUnit = (u: "pct" | "usd") => {
    setSlUnit(u);
    setSlVal(priceToVal(slPrice, false, u));
  };
  const tpNum = parseFloat(tpPrice) || 0;
  const slNum = parseFloat(slPrice) || 0;
  // deeptrade semantics: TP/SL only for borrowing (leveraged) entries,
  // never for reduce-only orders
  const tpslAllowed = canBorrow && !reduceOnly;

  const problem = useMemo(() => {
    if (!qty) return null;
    if (orderType === "limit" && !priceNum) return "Enter a price";
    if (orderType === "market" && midPrice == null)
      return "No live market price";
    if (minSize && qty < minSize - 1e-12)
      return `Minimum size is ${minSize} ${pool.base}`;
    if (reduceOnly && hasDebt && !reduceSideOk)
      return `Reduce-only must ${hasBaseDebt ? "Long (buy back the borrowed " + pool.base + ")" : "Short (sell into the " + pool.quote + " debt)"}`;
    if (tpslOn && mark > 0) {
      if (tpNum > 0 && (isBid ? tpNum <= mark : tpNum >= mark))
        return `Take profit must be ${isBid ? "above" : "below"} ${formatAmount(mark, priceDp)}`;
      if (slNum > 0 && (isBid ? slNum >= mark : slNum <= mark))
        return `Stop loss must be ${isBid ? "below" : "above"} ${formatAmount(mark, priceDp)}`;
    }
    if (needAmt > spendable + 1e-9) {
      if (tradingMode === "normal")
        return `Insufficient ${needCoin} — switch Trading Mode to Borrow, or deposit more`;
      if (borrowBlocked)
        return `You already owe ${isBid ? pool.base : pool.quote} — repay it before borrowing ${needCoin}`;
      return leverage >= maxLev
        ? `Exceeds ${maxLev}x capacity — max ~${formatAmount(spendable, 4)} ${needCoin}`
        : `Insufficient at ${leverage}x — raise leverage or deposit more`;
    }
    return null;
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [
    qty,
    orderType,
    priceNum,
    midPrice,
    minSize,
    needAmt,
    spendable,
    needCoin,
    pool.base,
    pool.quote,
    reduceOnly,
    hasDebt,
    reduceSideOk,
    hasBaseDebt,
    tpslOn,
    tpNum,
    slNum,
    mark,
    isBid,
    priceDp,
    borrowBlocked,
    leverage,
    maxLev,
    tradingMode,
  ]);

  // Per-field validation (presence / numeric format) via the zod schema; the
  // margin-specific feasibility checks above stay in `problem`.
  const parsed = marginOrderFormSchema.safeParse({ orderType, price, size });
  const priceError =
    touched && orderType === "limit" ? fieldIssue(parsed, "price") : undefined;
  const sizeError = touched ? fieldIssue(parsed, "size") : undefined;

  const canSubmit =
    !!address &&
    !!managerId &&
    parsed.success &&
    qty > 0 &&
    !problem &&
    !isPending;

  /** Funding waterfall per trading mode → deposits[] + borrow amount. */
  const planFunding = () => {
    const deposits: { side: "base" | "quote"; amount: number }[] = [];
    const needSide: "base" | "quote" = isBid ? "quote" : "base";
    let borrowAmt = 0;

    if (tradingMode === "borrowOnly" && canBorrow) {
      // borrow first (perp-style); wallet/manager cover only the remainder
      borrowAmt = Math.min(needAmt * 1.002, borrowCap);
      const rem = Math.max(0, needAmt - borrowAmt - available);
      const dep = Math.min(walletNeed, rem * 1.001);
      if (dep > 1e-9 && autoDeposit !== "off")
        deposits.push({ side: needSide, amount: dep });
    } else {
      // own funds first (manager, then wallet via auto-deposit), borrow last
      const afterManager = Math.max(0, needAmt - available);
      const dep =
        autoDeposit === "off" ? 0 : Math.min(walletNeed, afterManager * 1.001);
      if (dep > 1e-9) deposits.push({ side: needSide, amount: dep });
      const rem = Math.max(0, afterManager - dep);
      if (rem > 1e-9 && canBorrow) borrowAmt = Math.min(rem * 1.002, borrowCap);
    }

    // "Both": deposit the other asset as collateral when the borrow needs it
    if (borrowAmt > 1e-9 && otherDepositCap > 0) {
      const plainCap = isBid
        ? maxAdditionalBorrowQuote(pos, oraclePrice, risk?.minBorrow ?? 1.25)
        : maxAdditionalBorrowQuote(pos, oraclePrice, risk?.minBorrow ?? 1.25) /
          (effPrice || 1);
      const capShort = Math.max(0, borrowAmt - plainCap);
      if (capShort > 1e-9 && leverage > 1) {
        const otherAmt = Math.min(
          walletOther,
          (isBid
            ? capShort / (leverage - 1) / (oraclePrice || 1)
            : (capShort * (effPrice || 1)) / (leverage - 1)) * 1.02,
        );
        if (otherAmt > 1e-9)
          deposits.push({ side: isBid ? "base" : "quote", amount: otherAmt });
      }
    }
    if (borrowAmt > 0) borrowAmt = Math.max(borrowAmt, 0.1); // protocol min
    return { deposits, borrowAmt };
  };

  const submit = async () => {
    if (!canSubmit) return;
    const { deposits, borrowAmt } = planFunding();
    const ok = await placeOrder({
      type: orderType,
      isBid,
      quantity: quantizeDown(qty, lot || 1e-9),
      price:
        orderType === "limit"
          ? quantizeDown(priceNum, tick || 1e-9)
          : undefined,
      postOnly: orderType === "limit" && tif === "GTC" ? postOnly : undefined,
      tif: orderType === "limit" ? tif : undefined,
      slippagePct: orderType === "market" ? slippage : undefined,
      markPrice: orderType === "market" ? (midPrice ?? undefined) : undefined,
      reduceOnly:
        reduceOnly && hasDebt ? { debtIsBase: hasBaseDebt } : undefined,
      deposits: deposits.length ? deposits : undefined,
      borrow:
        borrowAmt > 0
          ? { side: isBid ? "quote" : "base", amount: borrowAmt }
          : undefined,
      tpsl:
        tpslOn && tpslAllowed && (tpNum > 0 || slNum > 0)
          ? {
              takeProfit:
                tpNum > 0 ? quantizeDown(tpNum, tick || 1e-9) : undefined,
              stopLoss:
                slNum > 0 ? quantizeDown(slNum, tick || 1e-9) : undefined,
            }
          : undefined,
    });
    if (ok) {
      setSize("");
      setSizePercent(0);
      setTpPrice("");
      setTpVal("");
      setSlPrice("");
      setSlVal("");
      setTouched(false);
    }
  };

  // est. post-trade liquidation price (display only; protocol re-checks)
  const estLiqPrice = useMemo(() => {
    if (!risk || !qty || effPrice <= 0) return null;
    const shortfall = Math.max(0, needAmt - available);
    const borrowAmt = shortfall > 1e-9 && borrowCap > 0 ? shortfall : 0;
    const next: MarginPosition = isBid
      ? {
          baseAsset: pos.baseAsset + qty,
          quoteAsset: Math.max(0, pos.quoteAsset + borrowAmt - needAmt),
          baseDebt: pos.baseDebt,
          quoteDebt: pos.quoteDebt + borrowAmt,
        }
      : {
          baseAsset: Math.max(0, pos.baseAsset + borrowAmt - qty),
          quoteAsset: pos.quoteAsset + orderValue * (1 - feeBuffer),
          baseDebt: pos.baseDebt + borrowAmt,
          quoteDebt: pos.quoteDebt,
        };
    return liquidationPrice(next, risk.liquidation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    risk,
    qty,
    effPrice,
    needAmt,
    available,
    borrowCap,
    isBid,
    orderValue,
    feeBuffer,
    snap,
  ]);

  return (
    <div className="h-full flex flex-col bg-[#121417] text-foreground overflow-y-auto">
      <MarginHeaderControls
        tradingMode={tradingMode}
        onTradingModeChange={setTradingMode}
        leverage={leverage}
        onLeverageChange={setLeverage}
        maxLev={maxLev}
        orderType={orderType}
        onOrderTypeChange={setOrderType}
        baseLabel={pool.base}
      />

      {/* long / short segmented */}
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-center bg-[#1A1D1F] py-1 px-1.5 rounded-full h-8.75">
          {(["long", "short"] as const).map((s) => {
            const active = side === s;
            return (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`flex-1 h-full cursor-pointer rounded-full text-xs transition-all ${
                  active
                    ? s === "long"
                      ? "bg-primary text-[#121417] font-semibold"
                      : "bg-[#FF4D4F] text-white font-semibold"
                    : "bg-transparent text-nav-inactive font-medium"
                }`}
              >
                {s === "long" ? `Long ${pool.base}` : `Short ${pool.base}`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {borrowBlocked && tradingMode !== "normal" && (
          <p className="text-[10px] text-[#FFB84D]">
            Borrowing unavailable: repay your {isBid ? pool.base : pool.quote}{" "}
            loan first (one borrow side at a time).
          </p>
        )}

        <div className="space-y-1.5">
          <InfoRow
            label="Available to Trade"
            value={`${formatAmount(available, 4)} ${needCoin}`}
          />
          <InfoRow
            label={leverage > 1 ? `Buying Power (${leverage}x)` : "Borrowable"}
            value={
              leverage > 1
                ? `${formatAmount(spendable, 4)} ${needCoin}`
                : `${formatAmount(borrowableQuote, 2)} ${pool.quote}`
            }
            accent
          />
        </div>

        {orderType === "limit" && (
          <PriceField
            quoteLabel={pool.quote}
            value={price}
            onChange={onPriceChange}
            onApplyMid={onApplyMid}
            midPrice={midPrice}
            priceDp={priceDp}
            error={priceError}
          />
        )}

        <SizeField
          base={pool.base}
          quote={pool.quote}
          value={size}
          sizeUnit={sizeUnit}
          minSize={minSize}
          sizePercent={sizePercent}
          onChange={onSizeChange}
          onSelectUnit={handleUnitChange}
          onPercent={handlePercent}
          error={sizeError}
        />

        {orderType === "limit" && (
          <TimeInForce
            tif={tif}
            onSelect={onSelectTif}
            postOnly={postOnly}
            onPostOnlyChange={setPostOnly}
          />
        )}

        <div className="flex items-center justify-between gap-3">
          <label
            className={`flex items-center gap-2 text-xs ${
              hasDebt
                ? "text-nav-inactive cursor-pointer"
                : "text-nav-inactive/40 cursor-not-allowed"
            }`}
            title={
              hasDebt
                ? "Only reduces your position — cannot increase or open one"
                : "Requires an existing position with debt"
            }
          >
            <input
              type="checkbox"
              checked={reduceOnly && hasDebt}
              disabled={!hasDebt}
              onChange={(e) => {
                setReduceOnly(e.target.checked);
                if (e.target.checked) setTpslOn(false);
              }}
              className="accent-[#02DA8B]"
            />
            Reduce Only
          </label>
          <AutoDepositSelect
            value={autoDeposit}
            onChange={setAutoDeposit}
            needCoin={needCoin}
          />
        </div>

        {/* TP / SL attached to this order (leveraged entries only) */}
        <div className="space-y-2">
          <label
            className={`flex items-center gap-2 text-xs ${
              tpslAllowed
                ? "text-nav-inactive cursor-pointer"
                : "text-nav-inactive/40 cursor-not-allowed"
            }`}
            title={
              tpslAllowed
                ? "Arm take-profit / stop-loss triggers with this order"
                : reduceOnly
                  ? "TP/SL is not available for reduce-only orders"
                  : "TP/SL is only available for orders that borrow (Trading Mode: Borrow)"
            }
          >
            <input
              type="checkbox"
              checked={tpslOn && tpslAllowed}
              disabled={!tpslAllowed}
              onChange={(e) => setTpslOn(e.target.checked)}
              className="accent-[#02DA8B]"
            />
            Take Profit / Stop Loss
          </label>
          {tpslOn && tpslAllowed && (
            <div className="grid grid-cols-2 gap-2">
              <TpSlInput
                placeholder="TP Price"
                value={tpPrice}
                onChange={onTpPrice}
              />
              <GainLossField
                placeholder="Gain"
                value={tpVal}
                onChange={onTpVal}
                unit={tpUnit}
                onUnit={onTpUnit}
              />
              <TpSlInput
                placeholder="SL Price"
                value={slPrice}
                onChange={onSlPrice}
              />
              <GainLossField
                placeholder="Loss"
                value={slVal}
                onChange={onSlVal}
                unit={slUnit}
                onUnit={onSlUnit}
              />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-6 pb-4 space-y-3 mt-auto">
        {!address ? (
          <ConnectWalletDialog
            trigger={
              <Button
                type="button"
                className="w-full h-8 rounded-[28px] bg-primary text-[#121417] font-semibold hover:bg-primary/90"
              >
                Connect Sui wallet
              </Button>
            }
          />
        ) : !managerId ? (
          <Button
            type="button"
            disabled={isCreating || managerLoading}
            onClick={() => create()}
            className="w-full h-8 rounded-[28px] bg-primary text-[#121417] font-semibold hover:bg-primary/90"
          >
            {isCreating
              ? "Creating margin account…"
              : `Create ${pool.base}/${pool.quote} margin account`}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="w-full h-8 rounded-[28px] font-semibold disabled:opacity-70"
            style={{
              backgroundColor: isBid ? "#02DA8B" : "#FF4D4F",
              color: isBid ? "#121417" : "#FFFFFF",
            }}
          >
            {isPending
              ? (status ?? "Working…")
              : `${isBid ? "Long" : "Short"} ${pool.base}`}
          </Button>
        )}

        {touched && problem && qty > 0 && (
          <p className="text-xs text-[#FFB84D]">{problem}</p>
        )}

        <div className="space-y-1.5 border-t border-border pt-3">
          <InfoRow
            label="Order Value"
            hint="Notional value of this order, before fees."
            value={
              orderValue > 0
                ? `${formatAmount(orderValue, 2)} ${pool.quote}`
                : "—"
            }
          />
          {qty > 0 && needAmt > available + 1e-9 && borrowCap > 0 && (
            <InfoRow
              label="Auto-borrow"
              value={`${formatAmount(Math.max(needAmt - available, 0.1), 4)} ${needCoin}`}
              accent
            />
          )}
          {estLiqPrice != null && qty > 0 && (
            <InfoRow
              label="Est. Liq. Price"
              hint="Estimated liquidation price after this order fills — the protocol re-checks on submit."
              value={formatAmount(estLiqPrice, priceDp)}
            />
          )}
          {orderType === "market" && (
            <MaxSlippageControl
              slippage={slippage}
              onChange={setSlippage}
              description="Max slippage only affects market orders placed from the order form. Closing positions will use max slippage of 8% and market TP/SL orders will use max slippage of 10%."
            />
          )}
          <InfoRow
            label="Fees"
            hint="Taker fee on the filled amount; resting (maker) orders pay less."
            value={
              params?.whitelisted
                ? "0% (whitelisted pool)"
                : `~0.1% taker · paid in ${needCoin}`
            }
          />
          <InfoRow
            label="Max Leverage"
            hint="Maximum leverage allowed by this pool's risk parameters."
            value={
              risk ? `${formatAmount(maxLeverage(risk.minBorrow), 1)}x` : "—"
            }
          />
          {!managerId && address && !managerLoading && (
            <p className="pt-1 text-[11px] leading-snug text-nav-inactive">
              One margin account per pool — it wraps its own trading balance and
              borrows from the {pool.base}/{pool.quote} lending pools.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type AutoDeposit = "off" | "single" | "both";

/** Compact Auto-deposit selector styled like Time-in-Force — a dotted label
 *  with a hover-card of the options + a value dropdown. Sits opposite Reduce
 *  Only to save a full row. */
function AutoDepositSelect({
  value,
  onChange,
  needCoin,
}: {
  value: AutoDeposit;
  onChange: (v: AutoDeposit) => void;
  needCoin: string;
}) {
  const OPTIONS: { value: AutoDeposit; label: string; desc: string }[] = [
    {
      value: "single",
      label: "Single",
      desc: `Only ${needCoin} is auto-deposited from your wallet as collateral.`,
    },
    {
      value: "both",
      label: "Both",
      desc: "Both base and quote can be auto-deposited from your wallet as collateral.",
    },
    {
      value: "off",
      label: "Off",
      desc: "No auto-deposits — only funds already in the margin manager.",
    },
  ];
  const current = OPTIONS.find((o) => o.value === value);
  return (
    <div className="flex items-center gap-2">
      <HoverCard openDelay={100} closeDelay={80}>
        <HoverCardTrigger asChild>
          <span className="cursor-help text-[11px] text-nav-inactive underline decoration-dotted decoration-nav-inactive/50 underline-offset-4">
            Auto-deposit
          </span>
        </HoverCardTrigger>
        <HoverCardContent align="end" className="w-64">
          <div className="space-y-2 text-xs leading-snug">
            <p className="font-medium text-white">Auto-deposit</p>
            {OPTIONS.map((o) => (
              <p key={o.value} className="text-nav-inactive">
                <span className="font-semibold text-primary">{o.label}</span> —{" "}
                {o.desc}
              </p>
            ))}
          </div>
        </HoverCardContent>
      </HoverCard>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-1 text-xs font-medium text-white outline-none hover:text-white/80">
          {current?.label ?? value}
          <ChevronDown className="size-3.5 text-nav-inactive" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {OPTIONS.map((o) => (
            <DropdownMenuItem
              key={o.value}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-0",
                o.value === value && "text-primary",
              )}
            >
              <span className="text-xs font-medium">{o.label}</span>
              <span className="text-[10px] leading-snug text-nav-inactive">
                {o.desc}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** TP / SL price input (left column of the TP/SL grid). */
function TpSlInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex h-9 items-center rounded-lg border border-[#2D3134] px-3">
      <input
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        className="w-full bg-transparent text-xs text-white outline-none placeholder:text-nav-inactive/60"
      />
    </div>
  );
}

/** Gain / Loss field — an editable value two-way linked with the TP/SL price,
 *  plus a unit selector: % move or $ price-move from the entry reference. */
function GainLossField({
  placeholder,
  value,
  onChange,
  unit,
  onUnit,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  unit: "pct" | "usd";
  onUnit: (u: "pct" | "usd") => void;
}) {
  return (
    <div className="flex h-9 items-center gap-1 rounded-lg border border-[#2D3134] px-3">
      <input
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        className="w-full min-w-0 bg-transparent text-xs text-white outline-none placeholder:text-nav-inactive/60"
      />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex shrink-0 items-center gap-1 text-xs text-white outline-none">
          {unit === "pct" ? "%" : "$"}
          <ChevronDown className="size-3.5 text-nav-inactive" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[8rem]">
          <DropdownMenuItem
            onClick={() => onUnit("pct")}
            className="cursor-pointer text-xs"
          >
            % move
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onUnit("usd")}
            className="cursor-pointer text-xs"
          >
            $ price move
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function InfoRow({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex justify-between text-xs">
      <span
        className={`text-nav-inactive ${
          hint
            ? "cursor-help underline decoration-dotted decoration-nav-inactive/40 underline-offset-4"
            : ""
        }`}
        title={hint}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${accent ? "text-primary" : "text-white"}`}
      >
        {value}
      </span>
    </div>
  );
}

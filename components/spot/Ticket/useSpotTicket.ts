"use client";

/**
 * Headless spot order-ticket controller. Owns all form state, derives the order
 * plan via the pure `computeOrderPlan` domain function, runs validation, and
 * orchestrates submit. The presentational `<SpotTicket>` consumes the returned
 * view-model and renders — no business logic in the component.
 */
import { useMemo, useState } from "react";
import {
  decimalsOf,
  formatAmount,
  getSpotPool,
  quantizeDown,
} from "@/lib/deepbook/core";
import { TAKER_FEE_PCT } from "@/lib/deepbook/domain/constants";
import {
  computeOrderPlan,
  maxQtyForPercent,
  type OrderSide,
  type OrderType,
} from "@/lib/deepbook/domain/orderMath";
import { useBalanceManager, useDeepBookAddress } from "@/lib/deepbook/hooks/account";
import {
  useManagerBalances,
  usePoolParams,
  useWalletBalances,
} from "@/lib/deepbook/hooks/reads";
import { useSpotActions } from "@/lib/deepbook/hooks/useSpotActions";
import { orderFormSchema, fieldIssue, type Tif } from "./orderSchema";
import type { TerminalPrefill } from "./types";

export type { Tif } from "./orderSchema";

export type UseSpotTicketArgs = {
  poolKey: string;
  midPrice: number | null;
  bestBid?: number | null;
  bestAsk?: number | null;
  prefill: TerminalPrefill;
};

export function useSpotTicket({
  poolKey,
  midPrice,
  bestBid,
  bestAsk,
  prefill,
}: UseSpotTicketArgs) {
  const pool = getSpotPool(poolKey);
  const address = useDeepBookAddress();
  const { managerId, isLoading: managerLoading, create, isCreating } =
    useBalanceManager();
  const { data: params } = usePoolParams(poolKey);
  const { data: managerBal } = useManagerBalances();
  const { data: walletBal } = useWalletBalances();
  const { placeOrder, isPending, status } = useSpotActions(poolKey);

  const [side, setSide] = useState<OrderSide>("buy");
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [sizeUnit, setSizeUnit] = useState<string>(pool.base);
  const [sizePercent, setSizePercent] = useState(0);
  const [autoDeposit, setAutoDeposit] = useState(true);
  const [slippage, setSlippage] = useState(0.5);
  const [postOnly, setPostOnly] = useState(false);
  const [tif, setTif] = useState<Tif>("GTC");
  const [touched, setTouched] = useState(false);

  const tick = params?.tickSize ?? 0;
  const lot = params?.lotSize ?? 0;
  const minSize = params?.minSize ?? 0;
  const priceDp = decimalsOf(tick);
  const qtyDp = decimalsOf(lot);

  // book-click → price prefill (render-time state adjust)
  const [seenPrefillNonce, setSeenPrefillNonce] = useState(0);
  if (prefill && prefill.nonce !== seenPrefillNonce) {
    setSeenPrefillNonce(prefill.nonce);
    setPrice(prefill.price.toFixed(priceDp));
    setOrderType("limit");
    setTouched(true);
  }
  // pool switch → reset
  const [prevPool, setPrevPool] = useState(poolKey);
  if (poolKey !== prevPool) {
    setPrevPool(poolKey);
    setPrice("");
    setSize("");
    setSizePercent(0);
    setSizeUnit(getSpotPool(poolKey).base);
    setTouched(false);
  }

  const priceNum = parseFloat(price) || 0;
  const sizeNum = parseFloat(size) || 0;

  const plan = computeOrderPlan({
    pool,
    side,
    orderType,
    priceNum,
    midPrice,
    sizeNum,
    sizeUnit,
    whitelisted: params?.whitelisted ?? false,
    managerBal,
    walletBal,
    autoDeposit,
  });
  const {
    isBid, effPrice, qty, orderValue, feeBuffer, needCoin, needAmt,
    available, deposit, insufficient,
  } = plan;
  const takerFeePct = params?.whitelisted ? 0 : TAKER_FEE_PCT;

  const setQtyFields = (newQty: number, pct?: number) => {
    const q = quantizeDown(Math.max(0, newQty), lot || 1e-9);
    setSize(
      sizeUnit === pool.base
        ? q > 0
          ? q.toFixed(qtyDp)
          : ""
        : q * effPrice > 0
          ? (q * effPrice).toFixed(2)
          : ""
    );
    if (pct !== undefined) setSizePercent(pct);
  };

  const handlePercent = (pct: number) => {
    setTouched(true);
    if (!effPrice && isBid) {
      setSizePercent(pct);
      return;
    }
    const maxQty = maxQtyForPercent(available, isBid, effPrice, feeBuffer);
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
          : ""
      );
    setSizeUnit(unit);
  };

  // input handlers that also flag the form as touched (drives error display)
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
  const onSelectTif = (t: Tif) => {
    setTif(t);
    if (t !== "GTC") setPostOnly(false);
  };

  const problem = useMemo(() => {
    if (!qty) return null;
    if (orderType === "limit" && !priceNum) return "Enter a price";
    if (orderType === "market" && midPrice == null) return "No live market price";
    if (minSize && qty < minSize - 1e-12)
      return `Minimum size is ${minSize} ${pool.base}`;
    if (insufficient)
      return `Insufficient ${needCoin} — need ~${formatAmount(needAmt)}, have ${formatAmount(available)}`;
    return null;
  }, [qty, orderType, priceNum, midPrice, minSize, insufficient, needCoin, needAmt, available, pool.base]);

  // Per-field validation (presence / numeric format) via the zod schema; the
  // contextual feasibility checks above stay in `problem`.
  const parsed = orderFormSchema.safeParse({
    orderType,
    side,
    price,
    size,
    sizeUnit,
    sizePercent,
    tif,
    postOnly,
    slippage,
    autoDeposit,
  });
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

  const submit = async () => {
    if (!canSubmit) return;
    const ok = await placeOrder({
      type: orderType,
      isBid,
      quantity: quantizeDown(qty, lot || 1e-9),
      price: orderType === "limit" ? quantizeDown(priceNum, tick || 1e-9) : undefined,
      deposit,
      postOnly: orderType === "limit" && tif === "GTC" ? postOnly : undefined,
      tif: orderType === "limit" ? tif : undefined,
      slippagePct: orderType === "market" ? slippage : undefined,
      // Bound the market order off the price it will actually hit — the best
      // bid for a sell, the best ask for a buy — NOT the mid. Anchoring on the
      // mid forces the order to cross half the spread before slippage even
      // applies, which on a wide testnet book silently fills 0.
      markPrice:
        orderType === "market"
          ? ((isBid ? bestAsk : bestBid) ?? midPrice ?? undefined)
          : undefined,
    });
    if (ok) {
      setSize("");
      setSizePercent(0);
      setTouched(false);
    }
  };

  return {
    pool,
    // account state
    address,
    managerId,
    managerLoading,
    create,
    isCreating,
    isPending,
    status,
    // form state
    side,
    setSide,
    orderType,
    setOrderType,
    price,
    size,
    sizeUnit,
    sizePercent,
    autoDeposit,
    setAutoDeposit,
    slippage,
    setSlippage,
    postOnly,
    setPostOnly,
    tif,
    // derived
    midPrice,
    priceDp,
    minSize,
    isBid,
    qty,
    orderValue,
    needCoin,
    available,
    takerFeePct,
    whitelisted: params?.whitelisted ?? false,
    problem,
    priceError,
    sizeError,
    canSubmit,
    touched,
    // handlers
    onPriceChange,
    onApplyMid,
    onSizeChange,
    handlePercent,
    handleUnitChange,
    onSelectTif,
    submit,
  };
}

export type SpotTicketModel = ReturnType<typeof useSpotTicket>;

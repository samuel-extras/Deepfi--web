"use client";

/**
 * Margin trade ticket — long/short limit & market orders through the margin
 * package's pool proxy. Orders spend the margin account's funds (own deposits
 * + borrowed); collateral and loans are managed in the position card below.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useMemo, useState } from "react";
import { ConnectWalletDialog } from "@/components/wallet/ConnectWalletDialog";
import { Button } from "@/components/ui/button";
import {
  decimalsOf,
  formatAmount,
  quantizeDown,
} from "@/lib/sui/deepbookSpot";
import { getMarginPoolMeta } from "@/lib/sui/deepbookMargin";
import { usePoolParams } from "@/hooks/useDeepBookSpot";
import {
  useMarginActions,
  useMarginManager,
  useMarginSnapshot,
} from "@/hooks/useDeepBookMargin";
import type { TicketPrefill } from "@/components/spot/TradeTicket";

export default function MarginTicket({
  poolKey,
  midPrice,
  prefill,
}: {
  poolKey: string;
  midPrice: number | null;
  prefill: TicketPrefill;
}) {
  const pool = getMarginPoolMeta(poolKey);
  const address = useActiveAccount()?.address;
  const { managerId, isLoading: managerLoading, create, isCreating } =
    useMarginManager(poolKey);
  const { data: params } = usePoolParams(poolKey);
  const { data: snap } = useMarginSnapshot(poolKey);
  const { placeOrder, isPending, status } = useMarginActions(poolKey);

  const [side, setSide] = useState<"long" | "short">("long");
  const [type, setType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");

  const tick = params?.tickSize ?? 0;
  const lot = params?.lotSize ?? 0;
  const minSize = params?.minSize ?? 0;
  const priceDp = decimalsOf(tick);
  const qtyDp = decimalsOf(lot);

  const [seenPrefillNonce, setSeenPrefillNonce] = useState(0);
  if (prefill && prefill.nonce !== seenPrefillNonce) {
    setSeenPrefillNonce(prefill.nonce);
    setPrice(prefill.price.toFixed(priceDp));
    setType("limit");
  }
  const [prevPoolKey, setPrevPoolKey] = useState(poolKey);
  if (poolKey !== prevPoolKey) {
    setPrevPoolKey(poolKey);
    setPrice("");
    setQty("");
  }

  const isBid = side === "long";
  const priceNum = parseFloat(price) || 0;
  const qtyNum = parseFloat(qty) || 0;
  const effPrice = type === "limit" ? priceNum : midPrice ?? 0;
  const total = effPrice * qtyNum;

  const needCoin = isBid ? pool.quote : pool.base;
  const feeBuffer = params?.whitelisted ? 0 : 0.02;
  const needAmt = isBid ? total * (1 + feeBuffer) : qtyNum;
  const available = isBid ? snap?.balances.quote ?? 0 : snap?.balances.base ?? 0;

  const sizeFromPct = (pct: number) => {
    if (!effPrice && isBid) return;
    const raw = isBid
      ? (available * pct) / (effPrice * (1 + feeBuffer))
      : available * pct;
    const q = quantizeDown(raw, lot || 1e-9);
    setQty(q > 0 ? q.toFixed(qtyDp) : "");
  };

  const problems = useMemo(() => {
    const out: string[] = [];
    if (!qtyNum) return out;
    if (type === "limit" && !priceNum) out.push("Enter a price");
    if (minSize && qtyNum < minSize - 1e-12)
      out.push(`Minimum size is ${minSize} ${pool.base}`);
    if (type === "market" && midPrice == null)
      out.push("No live price for market order");
    if (needAmt > available + 1e-9)
      out.push(
        `Not enough ${needCoin} in margin account (need ~${formatAmount(needAmt)}, have ${formatAmount(available)}) — deposit or borrow below`
      );
    return out;
  }, [qtyNum, priceNum, type, minSize, midPrice, needAmt, available, needCoin, pool.base]);

  const canSubmit =
    !!address && !!managerId && qtyNum > 0 && problems.length === 0 && !isPending;

  const submit = async () => {
    if (!canSubmit) return;
    const ok = await placeOrder({
      type,
      isBid,
      quantity: quantizeDown(qtyNum, lot || 1e-9),
      price: type === "limit" ? quantizeDown(priceNum, tick || 1e-9) : undefined,
    });
    if (ok) setQty("");
  };

  const sideClasses = (active: boolean, long: boolean) =>
    `flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
      active
        ? long
          ? "bg-emerald-600/15 text-emerald-400 border border-emerald-600"
          : "bg-rose-600/15 text-rose-400 border border-rose-600"
        : "border border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex gap-2">
        <button className={sideClasses(side === "long", true)} onClick={() => setSide("long")}>
          Long {pool.base}
        </button>
        <button className={sideClasses(side === "short", false)} onClick={() => setSide("short")}>
          Short {pool.base}
        </button>
      </div>

      <div className="mb-3 flex gap-3 text-xs">
        {(["limit", "market"] as const).map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`uppercase tracking-wide ${
              type === t
                ? "text-foreground font-semibold underline underline-offset-4"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {type === "limit" && (
        <Field label="Price" addon={pool.quote}>
          <input
            inputMode="decimal"
            placeholder={midPrice != null ? midPrice.toFixed(priceDp) : "0.0"}
            value={price}
            onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
            onBlur={() =>
              priceNum > 0 && tick > 0 &&
              setPrice(quantizeDown(priceNum, tick).toFixed(priceDp))
            }
            className="w-full bg-transparent text-sm text-foreground outline-none"
          />
          {midPrice != null && (
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setPrice(quantizeDown(midPrice, tick || 1e-9).toFixed(priceDp))}
            >
              MID
            </button>
          )}
        </Field>
      )}

      <Field label="Amount" addon={pool.base}>
        <input
          inputMode="decimal"
          placeholder={minSize ? `min ${minSize}` : "0.0"}
          value={qty}
          onChange={e => setQty(e.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={() =>
            qtyNum > 0 && lot > 0 && setQty(quantizeDown(qtyNum, lot).toFixed(qtyDp))
          }
          className="w-full bg-transparent text-sm text-foreground outline-none"
        />
      </Field>

      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {[0.25, 0.5, 0.75, 1].map(p => (
          <button
            key={p}
            onClick={() => sizeFromPct(p)}
            className="rounded border border-border py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {p * 100}%
          </button>
        ))}
      </div>

      <div className="mb-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>{type === "market" ? "Est. total" : "Total"}</span>
          <span className="text-foreground">
            {total > 0 ? `${formatAmount(total)} ${pool.quote}` : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>In margin account</span>
          <span>
            {formatAmount(available)} {needCoin}
          </span>
        </div>
      </div>

      {!address ? (
        <ConnectWalletDialog
          trigger={
            <Button className="w-full" type="button">
              Connect Sui wallet
            </Button>
          }
        />
      ) : !managerId ? (
        <Button
          className="w-full"
          type="button"
          disabled={isCreating || managerLoading}
          onClick={() => create()}
        >
          {isCreating ? "Creating margin account…" : `Create ${pool.label} margin account`}
        </Button>
      ) : (
        <Button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className={`w-full font-semibold ${
            isBid
              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
              : "bg-rose-600 hover:bg-rose-500 text-white"
          }`}
        >
          {isPending
            ? status ?? "Working…"
            : `${isBid ? "Long" : "Short"} ${pool.base} ${type === "market" ? "at market" : ""}`}
        </Button>
      )}

      {problems.length > 0 && qtyNum > 0 && (
        <p className="mt-2 text-xs text-amber-400">{problems[0]}</p>
      )}
      {!managerId && !managerLoading && address && (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          A margin account is bound to one pool. It wraps its own trading
          balance and can borrow from the {pool.base}/{pool.quote} lending pools.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  addon,
  children,
}: {
  label: string;
  addon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 text-[11px] text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
        {children}
        <span className="text-xs text-muted-foreground">{addon}</span>
      </div>
    </div>
  );
}

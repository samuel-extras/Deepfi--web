"use client";

/**
 * Take-profit / stop-loss panel — conditional orders stored on the margin
 * manager, executed permissionlessly by keepers when the oracle price crosses
 * the trigger. Stop loss = trigger below price; take profit = trigger above.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { decimalsOf, formatAmount, quantizeDown } from "@/lib/sui/deepbookSpot";
import { getMarginPoolMeta } from "@/lib/sui/deepbookMargin";
import { usePoolParams } from "@/hooks/useDeepBookSpot";
import {
  useConditionalOrders,
  useMarginActions,
  useMarginManager,
  useMarginSnapshot,
} from "@/hooks/useDeepBookMargin";

type Preset = "sl" | "tp";

export default function TpslPanel({
  poolKey,
  midPrice,
}: {
  poolKey: string;
  midPrice: number | null;
}) {
  const pool = getMarginPoolMeta(poolKey);
  const address = useActiveAccount()?.address;
  const { managerId } = useMarginManager(poolKey);
  const { data: snap } = useMarginSnapshot(poolKey);
  const { data: tpsl } = useConditionalOrders(poolKey);
  const { data: params } = usePoolParams(poolKey);
  const { addTpsl, cancelConditional, cancelAllConditionals, isPending, status } =
    useMarginActions(poolKey);

  const [preset, setPreset] = useState<Preset>("sl");
  const [side, setSide] = useState<"sell" | "buy">("sell");
  const [trigger, setTrigger] = useState("");
  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");

  if (!address || !managerId) return null;

  const tick = params?.tickSize ?? 0;
  const lot = params?.lotSize ?? 0;
  const priceDp = decimalsOf(tick);
  const qtyDp = decimalsOf(lot);

  const triggerNum = parseFloat(trigger) || 0;
  const qtyNum = parseFloat(qty) || 0;
  const limitNum = parseFloat(limitPrice) || 0;
  // SL fires when price drops BELOW the trigger; TP when it rises ABOVE
  const triggerBelowPrice = preset === "sl";

  const problem = (() => {
    if (!qtyNum || !triggerNum) return null;
    if (params?.minSize && qtyNum < params.minSize - 1e-12)
      return `Minimum size is ${params.minSize} ${pool.base}`;
    if (midPrice != null) {
      if (triggerBelowPrice && triggerNum >= midPrice)
        return `Stop trigger must be below the current price (${formatAmount(midPrice, priceDp)})`;
      if (!triggerBelowPrice && triggerNum <= midPrice)
        return `Take-profit trigger must be above the current price (${formatAmount(midPrice, priceDp)})`;
    }
    if (orderType === "limit" && !limitNum) return "Enter a limit price";
    return null;
  })();

  const canSubmit = qtyNum > 0 && triggerNum > 0 && !problem && !isPending;

  const submit = async () => {
    if (!canSubmit) return;
    const ok = await addTpsl({
      triggerPrice: quantizeDown(triggerNum, tick || 1e-9),
      triggerBelowPrice,
      order: {
        type: orderType,
        isBid: side === "buy",
        quantity: quantizeDown(qtyNum, lot || 1e-9),
        price:
          orderType === "limit"
            ? quantizeDown(limitNum, tick || 1e-9)
            : undefined,
      },
    });
    if (ok) {
      setQty("");
      setTrigger("");
      setLimitPrice("");
    }
  };

  const active = tpsl ?? [];
  const idsCount = snap?.conditionalOrderIds.length ?? 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">
          Take profit / Stop loss{idsCount ? ` (${idsCount})` : ""}
        </h3>
        {idsCount > 1 && (
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={isPending}
            onClick={() => cancelAllConditionals()}
            className="h-7 text-xs"
          >
            Cancel all
          </Button>
        )}
      </div>

      {/* active conditionals */}
      {idsCount > 0 && (
        <div className="border-b border-border">
          {active.map(o => (
            <div
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2 text-sm last:border-0"
            >
              <span className="text-foreground">
                <span className={o.triggerBelowPrice ? "text-rose-400" : "text-emerald-400"}>
                  {o.triggerBelowPrice ? "▼ below" : "▲ above"}{" "}
                  {formatAmount(o.triggerPrice, priceDp)}
                </span>
                <span className="text-muted-foreground"> → </span>
                {o.isBid ? "buy" : "sell"} {formatAmount(o.quantity, qtyDp)} {pool.base}{" "}
                {o.isLimit
                  ? `@ ${formatAmount(o.limitPrice ?? 0, priceDp)}`
                  : "at market"}
              </span>
              <button
                disabled={isPending}
                onClick={() => cancelConditional(o.id)}
                className="text-xs text-muted-foreground hover:text-rose-400 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ))}
          {active.length === 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground">
              Loading {idsCount} conditional order{idsCount > 1 ? "s" : ""}…
            </div>
          )}
        </div>
      )}

      {/* create form */}
      <div className="flex flex-wrap items-center gap-2 p-4">
        <div className="flex gap-1">
          {(
            [
              ["sl", "Stop loss"],
              ["tp", "Take profit"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setPreset(k)}
              className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                preset === k
                  ? k === "sl"
                    ? "border-rose-600 bg-rose-600/10 text-foreground"
                    : "border-emerald-600 bg-emerald-600/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["sell", "buy"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`rounded-md border px-2.5 py-1.5 text-xs capitalize transition-colors ${
                side === s
                  ? "border-border bg-muted/40 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s} {pool.base}
            </button>
          ))}
        </div>

        <MiniField
          placeholder={`trigger ${midPrice != null ? `(now ${formatAmount(midPrice, priceDp)})` : ""}`}
          value={trigger}
          onChange={setTrigger}
        />
        <MiniField placeholder={`qty (${pool.base})`} value={qty} onChange={setQty} />

        <div className="flex gap-1">
          {(["market", "limit"] as const).map(t => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`rounded-md border px-2.5 py-1.5 text-xs uppercase transition-colors ${
                orderType === t
                  ? "border-border bg-muted/40 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {orderType === "limit" && (
          <MiniField placeholder="limit price" value={limitPrice} onChange={setLimitPrice} />
        )}

        <Button type="button" size="sm" disabled={!canSubmit} onClick={submit}>
          {isPending ? status ?? "Working…" : "Arm"}
        </Button>
        {problem && qtyNum > 0 && (
          <span className="text-xs text-amber-400">{problem}</span>
        )}
      </div>
      <p className="px-4 pb-3 text-[11px] leading-snug text-muted-foreground">
        Triggers fire against the oracle price and are executed permissionlessly
        by keepers. Funds must be in the margin account when the order fires.
      </p>
    </div>
  );
}

function MiniField({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex min-w-[120px] items-center rounded-md border border-border bg-background px-3 py-1.5">
      <input
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}

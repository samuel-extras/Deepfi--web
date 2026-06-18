"use client";

/**
 * DeepBook spot trade ticket — limit & market orders against the live book.
 *
 * Funds flow: wallet → BalanceManager → order. If the trading account lacks
 * funds, the shortfall is deposited from the wallet inside the SAME PTB
 * ("auto top-up"), so a first trade is still a single signature.
 */
import { useMemo, useState } from "react";
import { ConnectModal } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";
import {
  decimalsOf,
  formatAmount,
  getSpotPool,
  quantizeDown,
} from "@/lib/sui/deepbookSpot";
import {
  useBalanceManager,
  useDeepBookAddress,
  useManagerBalances,
  usePoolParams,
  useSpotActions,
  useWalletBalances,
} from "@/hooks/useDeepBookSpot";

/** Keep some SUI in the wallet for gas when sizing/auto-depositing. */
const SUI_GAS_RESERVE = 0.3;
/** Headroom for input-token fees + market-order slippage. */
const FEE_BUFFER = 0.02;

export type TicketPrefill = { price: number; nonce: number } | null;

export default function TradeTicket({
  poolKey,
  midPrice,
  prefill,
}: {
  poolKey: string;
  midPrice: number | null;
  prefill: TicketPrefill;
}) {
  const pool = getSpotPool(poolKey);
  const address = useDeepBookAddress();
  const { managerId, isLoading: managerLoading, create, isCreating } =
    useBalanceManager();
  const { data: params } = usePoolParams(poolKey);
  const { data: managerBal } = useManagerBalances();
  const { data: walletBal } = useWalletBalances();
  const { placeOrder, isPending, status } = useSpotActions(poolKey);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [autoDeposit, setAutoDeposit] = useState(true);

  const tick = params?.tickSize ?? 0;
  const lot = params?.lotSize ?? 0;
  const minSize = params?.minSize ?? 0;
  const priceDp = decimalsOf(tick);
  const qtyDp = decimalsOf(lot);

  // clicking a book level fills the limit price (state-adjust during render)
  const [seenPrefillNonce, setSeenPrefillNonce] = useState(0);
  if (prefill && prefill.nonce !== seenPrefillNonce) {
    setSeenPrefillNonce(prefill.nonce);
    setPrice(prefill.price.toFixed(priceDp));
    setType("limit");
  }

  // reset inputs when switching pools
  const [prevPoolKey, setPrevPoolKey] = useState(poolKey);
  if (poolKey !== prevPoolKey) {
    setPrevPoolKey(poolKey);
    setPrice("");
    setQty("");
  }

  const isBid = side === "buy";
  const priceNum = parseFloat(price) || 0;
  const qtyNum = parseFloat(qty) || 0;
  const effPrice = type === "limit" ? priceNum : midPrice ?? 0;
  const total = effPrice * qtyNum;

  // which coin funds this order, and how much of it we need
  const needCoin = isBid ? pool.quote : pool.base;
  const feeBuffer = params?.whitelisted ? 0 : FEE_BUFFER;
  const needAmt = isBid ? total * (1 + feeBuffer) : qtyNum;

  const inManager = managerBal?.[needCoin] ?? 0;
  const inWalletRaw = walletBal?.[needCoin] ?? 0;
  const inWallet =
    needCoin === "SUI" ? Math.max(0, inWalletRaw - SUI_GAS_RESERVE) : inWalletRaw;

  const shortfall = Math.max(0, needAmt - inManager);
  const deposit =
    autoDeposit && shortfall > 0
      ? {
          coinKey: needCoin,
          // tiny headroom so rounding never leaves the order underfunded
          amount: Math.min(inWallet, shortfall * 1.001),
        }
      : undefined;
  const insufficient =
    qtyNum > 0 && shortfall > 0 && (!autoDeposit || shortfall > inWallet + 1e-9);

  const available = inManager + (autoDeposit ? inWallet : 0);

  const sizeFromPct = (pct: number) => {
    if (!effPrice && isBid) return;
    const raw = isBid
      ? (available * pct) / (effPrice * (1 + feeBuffer))
      : available * pct;
    const q = quantizeDown(raw, lot || 0.000000001);
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
    if (insufficient)
      out.push(`Not enough ${needCoin} (need ~${formatAmount(needAmt)})`);
    return out;
  }, [qtyNum, priceNum, type, minSize, midPrice, insufficient, needCoin, needAmt, pool.base]);

  const canSubmit =
    !!address && !!managerId && qtyNum > 0 && problems.length === 0 && !isPending;

  const submit = async () => {
    if (!canSubmit) return;
    const ok = await placeOrder({
      type,
      isBid,
      quantity: quantizeDown(qtyNum, lot || 0.000000001),
      price: type === "limit" ? quantizeDown(priceNum, tick || 0.000000001) : undefined,
      deposit,
    });
    if (ok) setQty("");
  };

  const sideClasses = (active: boolean, buy: boolean) =>
    `flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
      active
        ? buy
          ? "bg-emerald-600/15 text-emerald-400 border border-emerald-600"
          : "bg-rose-600/15 text-rose-400 border border-rose-600"
        : "border border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* side */}
      <div className="mb-3 flex gap-2">
        <button className={sideClasses(side === "buy", true)} onClick={() => setSide("buy")}>
          Buy {pool.base}
        </button>
        <button className={sideClasses(side === "sell", false)} onClick={() => setSide("sell")}>
          Sell {pool.base}
        </button>
      </div>

      {/* order type */}
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

      {/* price */}
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

      {/* quantity */}
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

      {/* % of available */}
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

      {/* totals */}
      <div className="mb-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>{type === "market" ? "Est. total" : "Total"}</span>
          <span className="text-foreground">
            {total > 0 ? `${formatAmount(total)} ${pool.quote}` : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Available</span>
          <span>
            {formatAmount(inManager)} {needCoin}
            {autoDeposit && inWallet > 0 ? (
              <span className="text-muted-foreground/70"> +{formatAmount(inWallet)} wallet</span>
            ) : null}
          </span>
        </div>
        {params && !params.whitelisted && (
          <div className="flex justify-between">
            <span>Fees</span>
            <span>paid in {needCoin} (no DEEP needed)</span>
          </div>
        )}
      </div>

      <label className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={autoDeposit}
          onChange={e => setAutoDeposit(e.target.checked)}
          className="accent-emerald-600"
        />
        Auto top-up from wallet in the same transaction
      </label>

      {/* CTA */}
      {!address ? (
        <ConnectModal
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
          {isCreating ? "Creating trading account…" : "Create trading account"}
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
            : `${isBid ? "Buy" : "Sell"} ${pool.base} ${type === "market" ? "at market" : ""}`}
        </Button>
      )}

      {problems.length > 0 && qtyNum > 0 && (
        <p className="mt-2 text-xs text-amber-400">{problems[0]}</p>
      )}
      {!managerId && !managerLoading && address && (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          One-time setup: a DeepBook BalanceManager (shared object) holds your
          trading funds across all pools.
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

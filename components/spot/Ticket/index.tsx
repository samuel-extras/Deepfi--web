"use client";

/**
 * Spot order ticket — dex terminal styling (underline order-type tabs, segmented
 * buy/sell, bordered input groups, % slider) on top of the DeepBook trading
 * hooks (simulate-before-sign, auto top-up deposit composed into the order PTB).
 *
 * Presentation only: all state, math, and zod validation live in
 * `useSpotTicket`; this component just lays out the pieces.
 */
import { ConnectModal } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/deepbook/core";
import OrderTypeTabs from "./OrderTypeTabs";
import SideToggle from "./SideToggle";
import PriceField from "./PriceField";
import SizeField from "./SizeField";
import TimeInForce from "./TimeInForce";
import TicketSummary from "./TicketSummary";
import { InfoRow } from "./InfoRow";
import { useSpotTicket } from "./useSpotTicket";
import type { TerminalPrefill } from "./types";

export type { TerminalPrefill } from "./types";

export default function SpotTicket({
  poolKey,
  midPrice,
  bestBid,
  bestAsk,
  prefill,
}: {
  poolKey: string;
  midPrice: number | null;
  bestBid?: number | null;
  bestAsk?: number | null;
  prefill: TerminalPrefill;
}) {
  const t = useSpotTicket({ poolKey, midPrice, bestBid, bestAsk, prefill });
  const { pool } = t;

  return (
    <div className="h-full flex flex-col bg-[#121417] text-foreground overflow-y-auto">
      <OrderTypeTabs value={t.orderType} onChange={t.setOrderType} />
      <SideToggle side={t.side} base={pool.base} onChange={t.setSide} />

      <div className="px-4 space-y-4">
        <InfoRow
          label="Available to Trade"
          value={`${formatAmount(t.available, 4)} ${t.needCoin}`}
        />

        {t.orderType === "limit" && (
          <PriceField
            quoteLabel={pool.quote}
            value={t.price}
            onChange={t.onPriceChange}
            onApplyMid={t.onApplyMid}
            midPrice={t.midPrice}
            priceDp={t.priceDp}
            error={t.priceError}
          />
        )}

        <SizeField
          base={pool.base}
          quote={pool.quote}
          value={t.size}
          sizeUnit={t.sizeUnit}
          minSize={t.minSize}
          sizePercent={t.sizePercent}
          onChange={t.onSizeChange}
          onSelectUnit={t.handleUnitChange}
          onPercent={t.handlePercent}
          error={t.sizeError}
        />

        {t.orderType === "limit" && (
          <TimeInForce
            tif={t.tif}
            onSelect={t.onSelectTif}
            postOnly={t.postOnly}
            onPostOnlyChange={t.setPostOnly}
          />
        )}
        <label className="flex items-center gap-2 text-xs text-nav-inactive cursor-pointer">
          <input
            type="checkbox"
            checked={t.autoDeposit}
            onChange={e => t.setAutoDeposit(e.target.checked)}
            className="accent-[#02DA8B]"
          />
          Auto top-up from wallet in the same transaction
        </label>
      </div>

      {/* footer: submit + summary */}
      <div className="px-4 pt-6 pb-4 space-y-3 mt-auto">
        {!t.address ? (
          <ConnectModal
            trigger={
              <Button
                type="button"
                className="w-full h-8 rounded-[28px] bg-primary text-[#121417] font-semibold hover:bg-primary/90"
              >
                Connect Sui wallet
              </Button>
            }
          />
        ) : !t.managerId ? (
          <Button
            type="button"
            disabled={t.isCreating || t.managerLoading}
            onClick={() => t.create()}
            className="w-full h-8 rounded-[28px] bg-primary text-[#121417] font-semibold hover:bg-primary/90"
          >
            {t.isCreating ? "Creating trading account…" : "Create trading account"}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!t.canSubmit}
            onClick={t.submit}
            className="w-full h-8 rounded-[28px] font-semibold disabled:opacity-70"
            style={{
              backgroundColor: t.isBid ? "#02DA8B" : "#FF4D4F",
              color: t.isBid ? "#121417" : "#FFFFFF",
            }}
          >
            {t.isPending
              ? (t.status ?? "Working…")
              : `${t.isBid ? "Buy" : "Sell"} ${pool.base}`}
          </Button>
        )}

        {t.touched && t.problem && t.qty > 0 && (
          <p className="text-xs text-[#FFB84D]">{t.problem}</p>
        )}

        <TicketSummary
          orderValue={t.orderValue}
          quoteLabel={pool.quote}
          whitelisted={t.whitelisted}
          takerFeePct={t.takerFeePct}
          needCoin={t.needCoin}
          showSetupNote={!t.managerId && !!t.address && !t.managerLoading}
          slippage={t.slippage}
          onSlippageChange={t.setSlippage}
          showSlippage={t.orderType === "market"}
        />
      </div>
    </div>
  );
}

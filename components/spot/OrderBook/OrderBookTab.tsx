"use client";

/** Order-book body: grouped depth ladder with spread row + footer controls.
 *  Aggregation/spread math comes from the domain layer; this just renders.
 *  Renders a plain panel body — the parent (tab content or section) provides
 *  the flex-col container, so it works in tab / stacked / large layouts. */
import { useMemo, useState } from "react";
import { usePoolParams } from "@/lib/deepbook/hooks/reads";
import { useOrderbook } from "@/lib/deepbook/api/queries";
import { decimalsOf, formatAmount, getSpotPool } from "@/lib/deepbook/core";
import { computeBookView } from "@/lib/deepbook/domain/orderbook";
import { GROUP_MULTIPLIERS } from "@/lib/deepbook/domain/constants";
import OrderList from "./OrderList";
import { ControlDropdown, FilterButton, type Filter } from "./DepthControls";

export default function OrderBookTab({
  poolKey,
  onPriceClick,
}: {
  poolKey: string;
  onPriceClick: (px: number) => void;
}) {
  const pool = getSpotPool(poolKey);
  const { data: params } = usePoolParams(poolKey);
  const tick = params?.tickSize ?? 0.00001;

  const [filter, setFilter] = useState<Filter>("both");
  const [groupMult, setGroupMult] = useState(1);
  const [sizeIn, setSizeIn] = useState<"base" | "quote">("base");

  const book = useOrderbook(poolKey, 100);

  const group = tick * groupMult;
  const groupDp = decimalsOf(group);
  const rowsPerSide = filter === "both" ? 11 : 22;

  const { asks, bids, maxAmount, spread, spreadPct, mid } = useMemo(
    () =>
      computeBookView({
        rawBids: book.data?.bids ?? [],
        rawAsks: book.data?.asks ?? [],
        group,
        rowsPerSide,
        sizeIn,
        mid: book.data?.mid ?? null,
      }),
    [book.data, group, rowsPerSide, sizeIn],
  );

  const sizeLabel = sizeIn === "base" ? pool.base : pool.quote;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* column header */}
      <div className="grid grid-cols-3 px-4 py-1.5 text-[11px] text-nav-inactive">
        <span>Price ({pool.quote})</span>
        <span className="text-right">Size ({sizeLabel})</span>
        <span className="text-right">Total ({sizeLabel})</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {book.isLoading ? (
          <div className="p-4 text-xs text-nav-inactive">Loading book…</div>
        ) : (
          <>
            {(filter === "both" || filter === "asks") && (
              <OrderList
                orders={asks}
                type="ask"
                maxAmount={maxAmount}
                sizeIn={sizeIn}
                priceDp={groupDp}
                onPriceClick={onPriceClick}
              />
            )}
            <div className="flex items-center justify-around border-y border-transparent bg-[#1A1D1F] px-4 py-1 text-xs">
              <span className="font-semibold text-white tabular-nums">
                {mid != null ? formatAmount(mid, Math.max(groupDp, 2)) : "—"}
              </span>
              <span className="text-nav-inactive tabular-nums">
                Spread {spread != null ? formatAmount(spread, groupDp) : "—"}
              </span>
              <span className="text-nav-inactive tabular-nums">
                {spreadPct != null ? ` (${formatAmount(spreadPct, 3)}%)` : ""}
              </span>
            </div>
            {(filter === "both" || filter === "bids") && (
              <OrderList
                orders={bids}
                type="bid"
                maxAmount={maxAmount}
                sizeIn={sizeIn}
                priceDp={groupDp}
                onPriceClick={onPriceClick}
              />
            )}
          </>
        )}
      </div>

      {/* controls */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <div className="flex items-center gap-1">
          <FilterButton current={filter} value="both" onClick={setFilter} />
          <FilterButton current={filter} value="bids" onClick={setFilter} />
          <FilterButton current={filter} value="asks" onClick={setFilter} />
        </div>
        <div className="flex items-center gap-1.5">
          <ControlDropdown
            label={formatAmount(group, groupDp)}
            options={GROUP_MULTIPLIERS.map((m) => ({
              label: formatAmount(tick * m, decimalsOf(tick * m)),
              value: String(m),
            }))}
            onSelect={(v) => setGroupMult(Number(v))}
          />
          <ControlDropdown
            label={sizeLabel}
            options={[
              { label: pool.base, value: "base" },
              { label: pool.quote, value: "quote" },
            ]}
            onSelect={(v) => setSizeIn(v as "base" | "quote")}
          />
        </div>
      </div>
    </div>
  );
}

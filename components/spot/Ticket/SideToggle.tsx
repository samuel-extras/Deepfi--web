"use client";

/** Buy / Sell segmented control. */
import { cn } from "@/lib/utils";
import type { OrderSide } from "@/lib/deepbook/domain/orderMath";

export default function SideToggle({
  side,
  base,
  onChange,
}: {
  side: OrderSide;
  base: string;
  onChange: (s: OrderSide) => void;
}) {
  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center bg-[#1A1D1F] py-1 px-1.5 rounded-full h-8.75">
        {(["buy", "sell"] as const).map((s) => {
          const active = side === s;
          return (
            <button
              key={s}
              onClick={() => onChange(s)}
              className={cn(
                "flex-1 h-full cursor-pointer rounded-full text-xs transition-all",
                active
                  ? s === "buy"
                    ? "bg-primary text-[#121417] font-semibold"
                    : "bg-[#FF4D4F] text-white font-semibold"
                  : "bg-transparent text-nav-inactive font-medium",
              )}
            >
              {s === "buy" ? `Buy ${base}` : `Sell ${base}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

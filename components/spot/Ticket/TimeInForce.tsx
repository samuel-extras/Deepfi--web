"use client";

/**
 * Limit-order options row: Post-Only toggle on the left, Time-in-Force on the
 * right as a dropdown (GTC / IOC / FOK) with a hover-card explaining each mode.
 */
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
import type { Tif } from "./orderSchema";

const TIF_INFO: Record<Tif, { title: string; desc: string }> = {
  GTC: {
    title: "Good Till Cancel",
    desc: "Rests on the book until it fills or you cancel it.",
  },
  IOC: {
    title: "Immediate Or Cancel",
    desc: "Fills as much as possible right now, cancels the rest.",
  },
  FOK: {
    title: "Fill Or Kill",
    desc: "Fills the whole order immediately, or cancels entirely.",
  },
};

const TIF_OPTIONS = ["GTC", "IOC", "FOK"] as const;

export default function TimeInForce({
  tif,
  onSelect,
  postOnly,
  onPostOnlyChange,
}: {
  tif: Tif;
  onSelect: (t: Tif) => void;
  postOnly: boolean;
  onPostOnlyChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label
        className={cn(
          "flex items-center gap-2 text-xs",
          tif === "GTC"
            ? "cursor-pointer text-nav-inactive"
            : "cursor-not-allowed text-nav-inactive/40"
        )}
        title={
          tif === "GTC"
            ? "Rests on the book only — rejected if any part would execute immediately"
            : "Post Only cannot be combined with IOC or FOK"
        }
      >
        <input
          type="checkbox"
          checked={postOnly && tif === "GTC"}
          disabled={tif !== "GTC"}
          onChange={(e) => onPostOnlyChange(e.target.checked)}
          className="accent-[#02DA8B]"
        />
        Post Only
      </label>

      <div className="flex items-center gap-2">
        <HoverCard openDelay={100} closeDelay={80}>
          <HoverCardTrigger asChild>
            <span className="cursor-help text-[11px] text-nav-inactive underline decoration-dotted decoration-nav-inactive/50 underline-offset-4">
              TIF
            </span>
          </HoverCardTrigger>
          <HoverCardContent align="end" className="w-64">
            <div className="space-y-2 text-xs leading-snug">
              <p className="font-medium text-white">Time in Force</p>
              {TIF_OPTIONS.map((o) => (
                <p key={o} className="text-nav-inactive">
                  <span className="font-semibold text-primary">{o}</span>{" "}
                  <span className="text-white">{TIF_INFO[o].title}</span> —{" "}
                  {TIF_INFO[o].desc}
                </p>
              ))}
            </div>
          </HoverCardContent>
        </HoverCard>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-1 text-xs font-medium text-white outline-none hover:text-white/80">
            {tif}
            <ChevronDown className="size-3.5 text-nav-inactive" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {TIF_OPTIONS.map((o) => (
              <DropdownMenuItem
                key={o}
                onClick={() => onSelect(o)}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-0",
                  o === tif && "text-primary"
                )}
              >
                <span className="text-xs font-medium">{o}</span>
                <span className="text-[10px] text-nav-inactive">
                  {TIF_INFO[o].title}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

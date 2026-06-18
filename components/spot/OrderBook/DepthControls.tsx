"use client";

/** Order-book footer controls: bid/ask filter toggles and pill dropdowns
 *  (tick grouping, base⇄quote size unit). */
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Filter = "both" | "bids" | "asks";

export function FilterButton({
  current,
  value,
  onClick,
}: {
  current: Filter;
  value: Filter;
  onClick: (f: Filter) => void;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      title={value === "both" ? "Bids & asks" : value === "bids" ? "Bids only" : "Asks only"}
      className={cn(
        "flex h-6 w-6 flex-col justify-center gap-[2px] rounded border px-[5px] transition-colors",
        active ? "border-[#3A3E42] bg-[#1A1D1F]" : "border-transparent hover:bg-[#1A1D1F]"
      )}
    >
      {value !== "bids" && <span className="h-[3px] w-full rounded-sm bg-[#FF4D4F]" />}
      {value !== "asks" && <span className="h-[3px] w-full rounded-sm bg-primary" />}
    </button>
  );
}

export function ControlDropdown({
  label,
  options,
  onSelect,
}: {
  label: string;
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 rounded-full border border-[#2D3134] px-2.5 py-1 text-[11px] text-white hover:bg-[#1A1D1F] outline-none">
        {label}
        <ChevronDown className="h-3 w-3 text-nav-inactive" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[90px] bg-[#16191C] border-border">
        {options.map(o => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => onSelect(o.value)}
            className="text-xs cursor-pointer"
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

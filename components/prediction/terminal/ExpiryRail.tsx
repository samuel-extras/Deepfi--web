"use client";

import { Button } from "@/components/ui/button";
/**
 * Rolling-expiry selector. One chip per live oracle, soonest first,
 * each with its own ticking countdown.
 */
import type { OracleDTO } from "./types";
import { clockTime } from "./types";
import { useCountdown } from "./useCountdown";
import { cn } from "@/lib/utils";

function ExpiryChip({
  oracle,
  selected,
  onSelect,
}: {
  oracle: OracleDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  const cd = useCountdown(oracle.expiry);
  return (
    <Button
      onClick={onSelect}
      className={`shrink-0 rounded-full text-sm font-semibold transition-all duration-150 cursor-pointer hover:bg-foreground ${
        selected
          ? "bg-foreground dark:text-background text-background"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={cn(
          "animate-pulse size-1  rounded-full",
          cd.urgency === "closing" ? "bg-amber-400" : "bg-destructive",
        )}
      />
      {clockTime(oracle.expiry)}
    </Button>
  );
}

export default function ExpiryRail({
  oracles,
  selectedId,
  onSelect,
}: {
  oracles: OracleDTO[];
  selectedId: string | null;
  onSelect: (o: OracleDTO) => void;
}) {
  if (!oracles.length) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {oracles.map((o) => (
        <ExpiryChip
          key={o.oracleId}
          oracle={o}
          selected={o.oracleId === selectedId}
          onSelect={() => onSelect(o)}
        />
      ))}
    </div>
  );
}

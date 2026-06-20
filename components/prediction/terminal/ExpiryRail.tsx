"use client";

/**
 * Rolling-expiry selector. A compact strip: a "Past" dropdown of recently
 * settled markets, then the soonest few live oracles as inline pills (only the
 * active one pulses), then a "More" dropdown of the further-out upcoming
 * expiries. Selecting a past market shows it read-only; PredictTerminal rolls
 * the active selection forward automatically as live slots expire.
 */
import { useMemo } from "react";
import { ChevronDown, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OracleDTO } from "./types";
import { clockTime, usd0 } from "./types";
import { useCountdown } from "./useCountdown";
import { cn } from "@/lib/utils";

const MIDDLE_COUNT = 3; // live pills shown inline (the current + 2 others)
const EDGE_COUNT = 6; // oracles listed in the More dropdown

const pillBase =
  "shrink-0 rounded-full text-sm font-semibold transition-all duration-150 cursor-pointer hover:bg-foreground";

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
      className={cn(
        pillBase,
        selected
          ? "bg-foreground text-background dark:text-background"
          : "bg-muted text-muted-foreground",
      )}
    >
      {/* only the active market pulses */}
      {selected ? (
        <span
          className={cn(
            "animate-pulse size-1 rounded-full",
            cd.urgency === "closing" ? "bg-amber-400" : "bg-destructive",
          )}
        />
      ) : null}
      {clockTime(oracle.expiry)}
    </Button>
  );
}

/** First pill — a dropdown of recently-settled markets (selectable, read-only). */
function PastDropdown({
  oracles,
  selectedId,
  onSelect,
}: {
  oracles: OracleDTO[];
  selectedId: string | null;
  onSelect: (o: OracleDTO) => void;
}) {
  const selectedHere = oracles.find((o) => o.oracleId === selectedId) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(
            pillBase,
            selectedHere
              ? "bg-foreground text-background dark:text-background"
              : "bg-muted text-muted-foreground hover:text-background",
          )}
        >
          <History className="size-3" />
          {selectedHere ? clockTime(selectedHere.expiry) : "Past"}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
          Recent settlements
        </DropdownMenuLabel>
        {oracles.length === 0 ? (
          <DropdownMenuItem disabled className="text-xs">
            No recent markets
          </DropdownMenuItem>
        ) : (
          oracles.map((o) => (
            <DropdownMenuItem
              key={o.oracleId}
              onClick={() => onSelect(o)}
              className={cn(
                "flex items-center justify-between gap-6 font-mono text-xs",
                o.oracleId === selectedId && "text-foreground",
              )}
            >
              <span>{clockTime(o.expiry)}</span>
              <span className="text-[10px] text-muted-foreground">
                {o.settlementPrice != null
                  ? `settled ${usd0(o.settlementPrice)}`
                  : "settled"}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Last pill — a dropdown of the further-out upcoming oracles (selectable). */
function MoreDropdown({
  oracles,
  selectedId,
  onSelect,
}: {
  oracles: OracleDTO[];
  selectedId: string | null;
  onSelect: (o: OracleDTO) => void;
}) {
  const selectedHere = oracles.find((o) => o.oracleId === selectedId) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(
            pillBase,
            selectedHere
              ? "bg-foreground text-background dark:text-background"
              : "bg-muted text-muted-foreground hover:text-background",
          )}
        >
          {selectedHere
            ? clockTime(selectedHere.expiry)
            : `+${oracles.length} more`}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
          Upcoming expiries
        </DropdownMenuLabel>
        {oracles.map((o) => (
          <DropdownMenuItem
            key={o.oracleId}
            onClick={() => onSelect(o)}
            className="flex items-center justify-between gap-6 font-mono text-xs"
          >
            <span>{clockTime(o.expiry)}</span>
            {o.oracleId === selectedId ? (
              <span className="animate-pulse size-1.5 rounded-full bg-destructive" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ExpiryRail({
  oracles,
  pastOracles,
  selectedId,
  onSelect,
}: {
  oracles: OracleDTO[];
  pastOracles: OracleDTO[];
  selectedId: string | null;
  onSelect: (o: OracleDTO) => void;
}) {
  const { middle, more } = useMemo(
    () => ({
      middle: oracles.slice(0, MIDDLE_COUNT),
      more: oracles.slice(MIDDLE_COUNT, MIDDLE_COUNT + EDGE_COUNT),
    }),
    [oracles],
  );

  if (!oracles.length) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <PastDropdown
        oracles={pastOracles}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      {middle.map((o) => (
        <ExpiryChip
          key={o.oracleId}
          oracle={o}
          selected={o.oracleId === selectedId}
          onSelect={() => onSelect(o)}
        />
      ))}
      {more.length > 0 ? (
        <MoreDropdown
          oracles={more}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}

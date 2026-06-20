"use client";

/**
 * URL state for the quick-bet modal (nuqs): `?bet=<oracleId>&dir=up|down`.
 * Driving it through the URL means a card's Yes/No can prefill the ticket, the
 * modal is shareable/deep-linkable, and back/forward closes it.
 */
import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import type { Direction } from "@/components/prediction/terminal/types";

export function useBetParams() {
  const [params, setParams] = useQueryStates({
    bet: parseAsString,
    dir: parseAsStringEnum<Direction>(["up", "down"]).withDefault("up"),
  });

  return {
    oracleId: params.bet,
    direction: params.dir,
    open: (oracleId: string, dir: Direction) => setParams({ bet: oracleId, dir }),
    close: () => setParams({ bet: null, dir: null }),
  };
}

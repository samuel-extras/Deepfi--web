"use client";

/**
 * Quick-bet modal state (zustand, not URL/nuqs).
 *
 * Holds the FULL oracle the card already has, so the modal renders the ticket
 * instantly — no `/api/oracles` round-trip, no skeleton. Cards select only the
 * stable `open` action, so opening/closing doesn't re-render the market grid.
 * (Deep-linkable trading lives on the oracle page `/prediction/[oracleId]`.)
 */
import { create } from "zustand";
import type { Direction, OracleDTO } from "@/components/prediction/terminal/types";

interface BetState {
  oracle: OracleDTO | null;
  direction: Direction;
  open: (oracle: OracleDTO, direction: Direction) => void;
  close: () => void;
}

export const useBetStore = create<BetState>((set) => ({
  oracle: null,
  direction: "up",
  open: (oracle, direction) => set({ oracle, direction }),
  close: () => set({ oracle: null }),
}));

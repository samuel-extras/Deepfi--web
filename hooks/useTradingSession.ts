"use client";

/**
 * STUB — the dex portfolio gates a "trading session" (Polymarket CLOB) behind
 * this. deepfi is gasless/zkLogin so there's no session to initialize; wire the
 * top-right button to whatever deepfi needs (e.g. withdraw) when you're ready.
 */
export interface TradingSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clobClient: any | null;
  initializeTradingSession: () => void;
  isTradingSessionComplete: boolean;
}

export function useTradingSession(): TradingSession {
  return {
    clobClient: null,
    initializeTradingSession: () => {},
    isTradingSessionComplete: false,
  };
}

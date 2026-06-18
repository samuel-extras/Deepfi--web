"use client";

export type NavigationPerfEvent = {
  event: "nav_transition";
  from: string;
  to: string;
  clickToPathChangeMs: number;
  fallbackUsed: boolean;
  at: number;
};

type PendingNavigation = {
  from: string;
  to: string;
  clickedAt: number;
  fallbackUsed: boolean;
};

type NavigationPerfAggregate = {
  totalTransitions: number;
  fallbackCount: number;
  lastLatencyMs: number | null;
  lastEvent: NavigationPerfEvent | null;
  events: NavigationPerfEvent[];
};

const MAX_EVENTS = 50;
let pendingNavigation: PendingNavigation | null = null;

const aggregate: NavigationPerfAggregate = {
  totalTransitions: 0,
  fallbackCount: 0,
  lastLatencyMs: null,
  lastEvent: null,
  events: [],
};

const getNow = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const updateDebugWindow = () => {
  if (typeof window === "undefined") return;
  (
    window as Window & { __DEX_NAV_METRICS__?: NavigationPerfAggregate }
  ).__DEX_NAV_METRICS__ = {
    ...aggregate,
    events: [...aggregate.events],
  };
};

const isDev = process.env.NODE_ENV !== "production";

export const startNavigationTracking = (from: string, to: string): void => {
  if (!from || !to || from === to) return;
  pendingNavigation = {
    from,
    to,
    clickedAt: getNow(),
    fallbackUsed: false,
  };
};

export const markNavigationFallbackUsed = (to: string): void => {
  if (!pendingNavigation || pendingNavigation.to !== to) return;
  pendingNavigation.fallbackUsed = true;
  aggregate.fallbackCount += 1;
  updateDebugWindow();
};

export const completeNavigationTracking = (
  pathnameAfterNavigation: string
): NavigationPerfEvent | null => {
  if (!pendingNavigation) return null;
  if (!pathnameAfterNavigation) return null;
  if (pathnameAfterNavigation === pendingNavigation.from) return null;

  const event: NavigationPerfEvent = {
    event: "nav_transition",
    from: pendingNavigation.from,
    to: pendingNavigation.to,
    clickToPathChangeMs: Math.round(getNow() - pendingNavigation.clickedAt),
    fallbackUsed: pendingNavigation.fallbackUsed,
    at: Date.now(),
  };

  aggregate.totalTransitions += 1;
  aggregate.lastLatencyMs = event.clickToPathChangeMs;
  aggregate.lastEvent = event;
  aggregate.events = [...aggregate.events, event].slice(-MAX_EVENTS);
  pendingNavigation = null;

  if (isDev) {
    console.debug("[perf][navigation]", event);
  }
  updateDebugWindow();

  return event;
};

export const getNavigationPerfSnapshot = (): NavigationPerfAggregate => ({
  ...aggregate,
  events: [...aggregate.events],
});

"use client";

import { useEffect, useState } from "react";

export type Countdown = {
  /** ms remaining; null until mounted (avoids SSR hydration mismatch) */
  ms: number | null;
  /** "12:42" under an hour, "3h 12m" above, "Expired" at 0 */
  label: string;
  /** drive color/pulse: calm → closing (<2m) → expired */
  urgency: "calm" | "closing" | "expired";
};

function fmt(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h < 24) return `${h}h ${m}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** 1s-ticking countdown to an epoch-ms deadline. SSR-safe (null first paint). */
export function useCountdown(expiryMs: number | null | undefined): Countdown {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    if (!expiryMs) {
      setMs(null);
      return;
    }
    const tick = () => setMs(Math.max(0, expiryMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiryMs]);

  if (ms == null) return { ms: null, label: "—", urgency: "calm" };
  return {
    ms,
    label: fmt(ms),
    urgency: ms <= 0 ? "expired" : ms < 2 * 60_000 ? "closing" : "calm",
  };
}

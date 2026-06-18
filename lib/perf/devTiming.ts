"use client";

type TimingMeta = Record<string, unknown>;

const isDev = process.env.NODE_ENV !== "production";

const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export const devTimingStart = (
  label: string,
  meta?: TimingMeta
): ((endMeta?: TimingMeta) => void) => {
  if (!isDev) return () => {};

  const startedAt = now();
  if (meta) {
    console.debug(`[perf][start] ${label}`, meta);
  } else {
    console.debug(`[perf][start] ${label}`);
  }

  return (endMeta?: TimingMeta) => {
    const durationMs = Math.round(now() - startedAt);
    if (endMeta) {
      console.debug(`[perf][end] ${label} (${durationMs}ms)`, endMeta);
    } else {
      console.debug(`[perf][end] ${label} (${durationMs}ms)`);
    }
  };
};

export const devTimingLog = (label: string, meta?: TimingMeta): void => {
  if (!isDev) return;
  if (meta) {
    console.debug(`[perf] ${label}`, meta);
    return;
  }
  console.debug(`[perf] ${label}`);
};

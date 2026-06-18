/**
 * Number formatting + tick/lot quantization helpers used across every DeepBook
 * surface. Pure and dependency-free.
 */

/** Decimal places implied by a step like 0.001 (max 9). */
export function decimalsOf(step: number): number {
  if (!step || step >= 1) return 0;
  return Math.min(9, Math.max(0, Math.round(-Math.log10(step))));
}

/** Round DOWN to a multiple of `step` (tick/lot size), float-safe. */
export function quantizeDown(value: number, step: number): number {
  if (!step || step <= 0 || !Number.isFinite(value)) return value;
  const n = Math.floor(value / step + 1e-9);
  return Number((n * step).toFixed(decimalsOf(step)));
}

export function formatAmount(n: number | null | undefined, maxDp = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: maxDp });
}

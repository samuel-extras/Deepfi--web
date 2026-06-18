import { cn } from "@/lib/utils";

/**
 * Label / value row used throughout the ticket (available, order value, fees).
 * Pass `hint` to render the label with a dotted underline + native tooltip.
 */
export function InfoRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex justify-between text-xs">
      <span
        className={cn(
          "text-nav-inactive",
          hint &&
            "cursor-help underline decoration-dotted decoration-nav-inactive/40 underline-offset-4"
        )}
        title={hint}
      >
        {label}
      </span>
      <span className="text-white tabular-nums ">{value}</span>
    </div>
  );
}

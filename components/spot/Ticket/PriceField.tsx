"use client";

/** Limit-price input — bordered input group with a one-tap "Mid" shortcut. */
import { Field, FieldError } from "@/components/ui/field";
import NumberInputGroup from "@/components/ui/number-input-group";

export default function PriceField({
  quoteLabel,
  value,
  onChange,
  onApplyMid,
  midPrice,
  priceDp,
  error,
}: {
  quoteLabel: string;
  value: string;
  onChange: (v: string) => void;
  onApplyMid: () => void;
  midPrice: number | null;
  priceDp: number;
  error?: string;
}) {
  return (
    <Field data-invalid={!!error || undefined}>
      <NumberInputGroup
        label={`Price (${quoteLabel})`}
        value={value}
        onValueChange={onChange}
        placeholder={midPrice != null ? midPrice.toFixed(priceDp) : "0.0"}
        showMidButton={midPrice != null}
        onMidClick={onApplyMid}
        invalid={!!error}
        groupClassName="border border-input rounded-full bg-[#1A1D1F]"
      />
      <FieldError>{error}</FieldError>
    </Field>
  );
}

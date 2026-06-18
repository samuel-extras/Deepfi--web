"use client";

/** Size input (base⇄quote unit switch) plus the % slider and % input. */
import { Field, FieldError } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import NumberInputGroup from "@/components/ui/number-input-group";

export default function SizeField({
  base,
  quote,
  value,
  sizeUnit,
  minSize,
  sizePercent,
  onChange,
  onSelectUnit,
  onPercent,
  error,
}: {
  base: string;
  quote: string;
  value: string;
  sizeUnit: string;
  minSize: number;
  sizePercent: number;
  onChange: (v: string) => void;
  onSelectUnit: (unit: string) => void;
  onPercent: (pct: number) => void;
  error?: string;
}) {
  return (
    <Field data-invalid={!!error || undefined}>
      <NumberInputGroup
        label="Size"
        value={value}
        onValueChange={onChange}
        addonOptions={[base, quote]}
        selectedAddon={sizeUnit}
        onSelectAddon={onSelectUnit}
        invalid={!!error}
        placeholder={minSize ? `min ${minSize} ${base}` : "0.0"}
        groupClassName="border border-input rounded-full bg-[#1A1D1F]"
      />
      <FieldError>{error}</FieldError>
      <div className="flex items-center gap-3 select-none pt-1">
        <div className="flex-1 py-1">
          <Slider
            value={[sizePercent]}
            min={0}
            max={100}
            step={1}
            marks={[0, 25, 50, 75, 100]}
            onValueChange={(vals) => onPercent(vals[0] ?? 0)}
          />
        </div>
        <div className="w-[70px]">
          <NumberInputGroup
            value={String(sizePercent)}
            onValueChange={(v) => {
              const n = Number(v);
              if (!Number.isNaN(n))
                onPercent(Math.max(0, Math.min(100, Math.floor(n))));
            }}
            addonText="%"
            groupClassName="border border-input rounded-full"
          />
        </div>
      </div>
    </Field>
  );
}

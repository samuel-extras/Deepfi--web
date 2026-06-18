"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NumberInputGroupProps = {
  value: string | number | undefined;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  groupClassName?: string;
  disabled?: boolean;
  addonText?: string;
  addonOptions?: string[];
  selectedAddon?: string;
  onSelectAddon?: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Mark the control invalid — red border + aria-invalid for a11y. */
  invalid?: boolean;
  /**
   * Optional sanitization function to apply to input value
   * before passing to onValueChange
   */
  sanitize?: (value: string) => string;
  /**
   * Show a "Mid" button that fills the input with mid price
   */
  showMidButton?: boolean;
  /**
   * Callback when mid button is clicked
   */
  onMidClick?: () => void;
};

export function NumberInputGroup({
  value,
  onValueChange,
  label,
  placeholder,
  className,
  groupClassName,
  disabled,
  addonText,
  addonOptions,
  selectedAddon,
  onSelectAddon,
  min,
  max,
  step,
  invalid,
  sanitize,
  showMidButton,
  onMidClick,
}: NumberInputGroupProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let next = e.target.value;

    // Allow only digits and a single decimal point; empty string allowed
    if (next === "") {
      onValueChange("");
      return;
    }

    const numericPattern = /^\d*(?:\.(\d*)?)?$/;
    if (!numericPattern.test(next)) return;

    // Apply optional sanitization
    if (sanitize) {
      next = sanitize(next);
    }

    onValueChange(next);
  };

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <InputGroup
        className={cn(
          "w-full bg-[#1A1D1F] rounded-lg",
          !groupClassName && "border-none",
          disabled && "opacity-60",
          groupClassName,
        )}
        data-disabled={disabled}
      >
        {label && (
          <InputGroupAddon>
            <span className="text-xs text-nav-inactive select-none">
              {label}
            </span>
          </InputGroupAddon>
        )}
        <InputGroupInput
          inputMode="decimal"
          pattern="[0-9]*[.]?[0-9]*"
          placeholder={placeholder}
          value={value ?? ""}
          onChange={handleChange}
          aria-label={label}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            "text-right text-sm text-white placeholder:text-nav-inactive h-8",
          )}
        />

        <InputGroupAddon align="inline-end" className="h-8">
          {addonOptions && addonOptions.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <InputGroupButton className="cursor-pointer text-white bg-transparent hover:bg-transparent focus-visible:bg-transparent active:bg-transparent group/drop-trigger rounded-lg border-none">
                  <span className="text-xs font-medium">
                    {selectedAddon ?? addonOptions[0]}
                  </span>
                  <ChevronDown className="size-3.5 transition-transform duration-150 group-data-[state=open]/drop-trigger:rotate-180" />
                </InputGroupButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[6rem]">
                {addonOptions.map((opt) => {
                  const isSelected = opt === (selectedAddon ?? addonOptions[0]);
                  return (
                    <DropdownMenuItem
                      key={opt}
                      onClick={() => onSelectAddon?.(opt)}
                      className={cn(
                        "cursor-pointer text-xs",
                        isSelected && "text-primary font-medium",
                      )}
                    >
                      {opt}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : addonText ? (
            <InputGroupText className="text-xs text-white">
              {addonText}
            </InputGroupText>
          ) : showMidButton && onMidClick ? (
            <InputGroupButton
              onClick={onMidClick}
              className="cursor-pointer pl-0 text-primary bg-transparent hover:!bg-transparent hover:text-primary/90 focus-visible:bg-transparent active:bg-transparent rounded-lg border-none"
            >
              <span className="text-xs font-medium">Mid</span>
            </InputGroupButton>
          ) : null}
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

export default NumberInputGroup;

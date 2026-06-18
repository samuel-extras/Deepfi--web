"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";

export type DropdownOption = { id: string; label: string } | { symbol: string };

type Props<T extends DropdownOption> = {
  label: string;
  options: T[];
  getKey: (opt: T) => string;
  getLabel: (opt: T) => string;
  selected: T;
  onSelect: (opt: T) => void;
};

export default function LabeledSelect<T extends DropdownOption>({
  label,
  options,
  getKey,
  getLabel,
  selected,
  onSelect,
}: Props<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [contentWidth, setContentWidth] = useState<number | undefined>();

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () =>
      setContentWidth(containerRef.current!.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="w-full flex-1">
      <InputGroup className="w-full rounded-[8px] border border-border justify-between">
        <InputGroupAddon>
          <span className="text-xs text-nav-inactive select-none whitespace-nowrap">
            {label}
          </span>
        </InputGroupAddon>
        <InputGroupAddon align="inline-end" className="h-9 w-full pr-1.5">
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                className="w-fit justify-between font-semibold border-none text-xs text-white rounded-[25px] hover:cursor-pointer bg-transparent lg:hover:bg-transparent gap-2 overflow-hidden ml-auto"
                type="button"
              >
                <span className="text-white text-xs font-normal">
                  {getLabel(selected)}
                </span>
                <ChevronDown
                  className={`transition-transform duration-200 ${
                    open ? "rotate-180" : "rotate-0"
                  }`}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="p-0"
              style={{ width: contentWidth, minWidth: contentWidth }}
            >
              {options.map(opt => (
                <DropdownMenuItem
                  key={getKey(opt)}
                  className="cursor-pointer text-xs"
                  onClick={() => onSelect(opt)}
                >
                  {getLabel(opt)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

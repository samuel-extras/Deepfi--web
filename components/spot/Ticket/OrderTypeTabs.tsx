"use client";

/**
 * Market / Limit order-type selector — underline tabs (replaces the old pill
 * dropdown). Active state is styled with raw `data-[state=active]:` selectors
 * because the shadcn `data-active:` variant emits no CSS in this project.
 */
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OrderType } from "@/lib/deepbook/domain/orderMath";

export const ORDER_TYPE_LABELS = { market: "Market", limit: "Limit" } as const;

export default function OrderTypeTabs({
  value,
  onChange,
}: {
  value: OrderType;
  onChange: (t: OrderType) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as OrderType)}>
      <TabsList
        variant="line"
        className="w-full justify-start gap-6 rounded-none border-b border-border bg-transparent p-0 px-4 min-h-10"
      >
        {(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map((t) => (
          <TabsTrigger
            key={t}
            value={t}
            className="relative flex-none rounded-none border-0 bg-transparent px-0 py-2.5 text-sm font-medium text-nav-inactive shadow-none transition-colors hover:text-white data-[state=active]:bg-transparent data-[state=active]:text-white dark:text-nav-inactive dark:hover:text-white dark:data-[state=active]:text-white after:absolute after:inset-x-0 after:h-px! after:rounded-full after:bg-primary after:opacity-0 data-[state=active]:after:opacity-100 group-data-horizontal/tabs:after:-bottom-px h-10"
          >
            {ORDER_TYPE_LABELS[t]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

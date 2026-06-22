"use client";

/**
 * Bottom account strip — Balances / Open Orders / Order History tabs. The tab
 * shell + a "Hide small balances" filter (applies to the Balances data table);
 * each tab is its own component.
 */
import { useCallback, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useTabIndicator } from "@/hooks/useTabIndicator";
import { useOpenOrders } from "@/lib/deepbook/hooks/reads";
import BalancesTable from "./BalancesTable";
import OpenOrdersTable from "./OpenOrdersTable";
import OrderHistoryTable from "./OrderHistoryTable";
import { Label } from "@/components/ui/label";

type TabId = "balances" | "openOrders" | "orderHistory";

const TABS: { id: TabId; label: string }[] = [
  { id: "balances", label: "Balances" },
  { id: "openOrders", label: "Open Orders" },
  { id: "orderHistory", label: "Order History" },
];

export default function AccountTables({ poolKey }: { poolKey: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("balances");
  const [hideSmall, setHideSmall] = useState(false);
  const tabTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onTabTriggerRef = useCallback(
    (id: string, el: HTMLButtonElement | null) => {
      tabTriggerRefs.current[id] = el;
    },
    [],
  );
  const { listRef, indicator } = useTabIndicator(activeTab, tabTriggerRefs);
  const { data: openOrders } = useOpenOrders(poolKey);

  return (
    <div className="border-t border-border bg-[#121417] col-span-4 overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabId)}
        className="gap-0 w-full flex flex-col"
        orientation="horizontal"
      >
        <div className="flex h-10 items-center border-b border-border pr-4 w-full">
          <div
            className="relative h-full w-fit "
            ref={listRef as React.RefObject<HTMLDivElement>}
          >
            <TabsList className="h-full bg-transparent p-0 gap-0 w-full">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  ref={(el) => onTabTriggerRef(t.id, el)}
                  className="h-full rounded-none px-4 text-xs data-[state=active]:bg-transparent"
                >
                  {t.label}
                  {t.id === "openOrders" && (openOrders?.orders.length ?? 0) > 0
                    ? ` (${openOrders!.orders.length})`
                    : ""}
                </TabsTrigger>
              ))}
              <div
                className="absolute bottom-0 h-0.5 rounded-full bg-foreground transition-all duration-300"
                style={{ left: indicator.left, width: indicator.width }}
              />
            </TabsList>
          </div>

          {activeTab === "balances" && (
            <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-nav-inactive cursor-pointer">
              <Label htmlFor="small-balances" className="text-xs">
                Hide small balances
              </Label>
              <Switch
                id="small-balances"
                size="sm"
                checked={hideSmall}
                onCheckedChange={setHideSmall}
                className="border-border data-[state=checked]:bg-primary data-[state=unchecked]:bg-[#3A3E42]"
              />
            </div>
          )}
        </div>

        <TabsContent value="balances" className="mt-0">
          <BalancesTable poolKey={poolKey} hideSmall={hideSmall} />
        </TabsContent>
        <TabsContent value="openOrders" className="mt-0">
          <OpenOrdersTable poolKey={poolKey} />
        </TabsContent>
        <TabsContent value="orderHistory" className="mt-0">
          <OrderHistoryTable poolKey={poolKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

/** Bottom Market / Trade / Account navigation for the mobile spot terminal. */
import { ArrowRightLeft, BarChart3, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileTab = "market" | "trade" | "account";

const NAV_ITEMS: { id: MobileTab; label: string; icon: typeof BarChart3 }[] = [
  { id: "market", label: "Market", icon: BarChart3 },
  { id: "trade", label: "Trade", icon: ArrowRightLeft },
  { id: "account", label: "Account", icon: Wallet },
];

export default function SpotMobileNav({
  activeTab,
  onTabChange,
}: {
  activeTab: MobileTab;
  onTabChange: (t: MobileTab) => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around gap-x-4 border-t border-border bg-[#121417] px-4 py-2 lg:hidden">
      {NAV_ITEMS.map(item => {
        const active = activeTab === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "flex items-center justify-center gap-x-2 rounded-full px-4 py-2 transition-all",
              active ? "bg-primary/10" : "bg-transparent"
            )}
          >
            <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-white")} />
            <span
              className={cn("text-sm", active ? "text-primary" : "text-nav-inactive")}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

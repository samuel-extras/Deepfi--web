"use client";

/**
 * Quick-bet modal — lets users bet from the markets list without opening the
 * oracle page. Renders the same `TradeTicket` inside a Dialog on desktop and a
 * Drawer on mobile. Open state + the full oracle come from `useBetStore` (the
 * card passes the oracle it already has), so the ticket renders instantly.
 */
import TradeTicket from "./terminal/TradeTicket";
import { useBetStore } from "@/stores/useBetStore";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePredictTicket } from "@/hooks/usePredictTicket";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export function BetModal() {
  const betOracle = useBetStore((s) => s.oracle);
  const direction = useBetStore((s) => s.direction);
  const close = useBetStore((s) => s.close);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const open = betOracle != null;

  const { oracle, svi, sel, patchSel, step } = usePredictTicket(
    betOracle,
    direction,
  );

  const onOpenChange = (next: boolean) => {
    if (!next) close();
  };

  const body = oracle ? (
    <TradeTicket
      oracle={oracle}
      svi={svi}
      sel={sel}
      step={step}
      onSelChange={patchSel}
    />
  ) : (
    <div className="h-120 animate-pulse rounded-xl border border-white/5 bg-white/[0.02]" />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-105"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Place your bet</DialogTitle>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="sr-only">
          <DrawerTitle>Place your bet</DrawerTitle>
        </DrawerHeader>
        <div className="max-h-[86vh] overflow-y-auto px-2 pb-6">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}

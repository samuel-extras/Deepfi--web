"use client";

/**
 * Quick-bet modal — lets users bet from the markets list without opening the
 * oracle page. Renders the same `TradeTicket` inside a Dialog on desktop and a
 * Drawer on mobile. Open state + prefill come from the URL via `useBetParams`.
 */
import TradeTicket from "./terminal/TradeTicket";
import { useBetParams } from "@/hooks/useBetParams";
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
  const { oracleId, direction, close } = useBetParams();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const open = oracleId != null;

  const { oracle, svi, sel, patchSel, step } = usePredictTicket(
    open ? oracleId : null,
    direction,
  );

  const onOpenChange = (next: boolean) => {
    if (!next) void close();
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

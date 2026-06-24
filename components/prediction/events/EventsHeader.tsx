// passes the real wallet balance (the user's dUSDC) and a transfer handler.
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";

interface EventsHeaderProps {
  balance?: string;
  onTransfer?: () => void;
}

export function EventsHeader({
  balance = "$0.00",
  onTransfer,
}: EventsHeaderProps) {
  const balanceValue = balance;

  const handleTransferClick = () => {
    onTransfer?.();
  };

  return (
    <motion.div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-2">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
          Prediction Markets
        </h1>
        <p className="text-xs text-muted-foreground/80 font-nornal">
          Binary BTC price markets, priced off DeepBook&apos;s live vol surface.
        </p>
      </div>

      <div className="flex items-center w-full md:w-auto">
        {/* Unified Balance & Action Container */}
        <div className="flex items-center w-fit gap-2">
          <div className="flex flex-col pr-3  items-center border-white/5 shrink-0 w-fit">
            <span className="text-[10px]  text-muted-foreground/60 uppercase tracking-widest whitespace-nowrap">
              Wallet
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-white tabular-nums whitespace-nowrap">
                {balanceValue}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 pr-1 ml-auto">
            <Button
              size="lg"
              className="bg-accent hover:bg-stone-900 text-foreground rounded-full px-10"
              asChild
            >
              <Link href="/prediction/portfolio">Portfolio</Link>
            </Button>

            <Button
              size="lg"
              onClick={handleTransferClick}
              className="bg-accent hover:bg-stone-900 text-foreground rounded-full px-10"
            >
              <Link href="/prediction/vault">Vault</Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Rules / Market context for the oracle — how its binaries & ranges resolve,
// and the concrete facts of this oracle (param-driven). DeepBook's analogue of
// the Polymarket "Rules / Market Context" block.
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OracleDetail } from "@/lib/predict";
import { ASSET_NAME, expiryLabel, usd0 } from "./format";

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function OracleRules({ detail }: { detail: OracleDetail }) {
  const asset = ASSET_NAME[detail.asset] ?? detail.asset;
  return (
    <Tabs defaultValue="rules">
      <TabsList className="bg-transparent gap-2">
        <TabsTrigger
          className="text-xs px-4 bg-muted rounded-full data-active:bg-foreground data-active:text-background data-active:hover:text-background dark:data-active:border-transparent dark:data-active:bg-foreground dark:data-active:text-background dark:data-active:hover:text-background"
          value="rules"
        >
          Rules
        </TabsTrigger>
        <TabsTrigger
          className="text-xs px-4 bg-muted rounded-full data-active:bg-foreground data-active:text-background data-active:hover:text-background dark:data-active:border-transparent dark:data-active:bg-foreground dark:data-active:text-background dark:data-active:hover:text-background"
          value="context"
        >
          Market context
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="rules"
        className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground bg-card p-4 lg:p-6 rounded-3xl"
      >
        <p>
          Each binary on this oracle resolves{" "}
          <span className="font-medium text-primary">Up</span> if {asset}
          &apos;s settlement price at {expiryLabel(detail.expiry)} is at or
          above the chosen strike, and{" "}
          <span className="font-medium text-destructive">Down</span> otherwise.
          Vertical ranges pay out when settlement lands inside the chosen band{" "}
          <span className="font-mono">(lower, higher]</span>.
        </p>
        <p>
          Prices derive from the on-chain SVI volatility surface — there is no
          order book. The protocol&apos;s PLP vault quotes and takes the other
          side of every trade, so a contract&apos;s price tracks its implied
          probability plus a small spread.
        </p>
        <p>
          Settlement is fixed by the first post-expiry price push to the oracle
          on DeepBook Predict and is final once recorded on-chain. Quote &amp;
          settlement asset:{" "}
          <span className="font-medium text-foreground">dUSDC</span> (testnet).
        </p>
      </TabsContent>

      <TabsContent
        className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground bg-card p-4 lg:p-6 rounded-3xl"
        value="context"
      >
        <div className="divide-y divide-border">
          <Fact label="Underlying" value={asset} />
          <Fact label="Expiry" value={expiryLabel(detail.expiry)} />
          <Fact
            label="Status"
            value={
              detail.live
                ? "Live"
                : detail.status === "settled"
                  ? "Settled"
                  : "Settling"
            }
          />
          <Fact
            label="Strike grid"
            value={`from ${usd0(detail.minStrike)} · $${detail.tickSize} ticks`}
          />
          {detail.settlementPrice != null && (
            <Fact
              label="Settlement price"
              value={usd0(detail.settlementPrice)}
            />
          )}
          <Fact
            label="Oracle ID"
            value={
              <span className="font-mono text-xs">
                {detail.oracleId.slice(0, 10)}…{detail.oracleId.slice(-6)}
              </span>
            }
          />
        </div>
        <Separator className="my-3" />
        <p className="text-xs text-muted-foreground">
          Source: predict-server.testnet.mystenlabs.com · DeepBook Predict on
          Sui testnet.
        </p>
      </TabsContent>
    </Tabs>
  );
}

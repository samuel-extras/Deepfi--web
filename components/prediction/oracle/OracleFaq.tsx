// Per-oracle FAQ — questions templated from the oracle in the URL param.
"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { OracleDetail } from "@/lib/predict";
import { ASSET_NAME, expiryLabel } from "./format";
import Link from "next/link";

export function OracleFaq({ detail }: { detail: OracleDetail }) {
  const asset = ASSET_NAME[detail.asset] ?? detail.asset;
  const when = expiryLabel(detail.expiry);

  const faqs: { q: string; a: string }[] = [
    {
      q: `What is the "${asset} — ${when}" market?`,
      a: `It's a DeepBook Predict oracle for ${asset} at the ${when} expiry. You can take an Up or Down position on any strike, or a vertical range, and each position settles on-chain from the oracle's settlement price.`,
    },
    {
      q: `How are the odds and prices set?`,
      a: `Every price comes from the on-chain SVI volatility surface, not an order book. The protocol's PLP vault quotes and takes the other side of each trade, so liquidity is always available. A contract's price (in cents) tracks its implied probability of paying out.`,
    },
    {
      q: `How do I trade this market?`,
      a: `Deposit dUSDC into your PredictManager, pick a strike (and Up/Down) or a range on the ladder above, size your order in the ticket, and mint. You can redeem any time before expiry, or after settlement to claim a winning payout.`,
    },
    {
      q: `How will "${asset} — ${when}" be resolved?`,
      a: `At ${when}, the first post-expiry oracle price push fixes the settlement price. Each Up binary pays $1 per contract if settlement is at or above its strike, otherwise $0 — and the reverse for Down. Ranges pay $1 if settlement lands in the band.`,
    },
    {
      q: `When does it expire?`,
      a: detail.live
        ? `${when}. It is live right now and accepting trades.`
        : `${when}. It has reached expiry and is ${detail.status === "settled" ? "settled" : "awaiting settlement"}.`,
    },
    {
      q: `Is this real money?`,
      a: `No. This is a DeepBook Predict deployment on Sui testnet using the dUSDC test asset. Nothing here is financial advice.`,
    },
  ];

  return (
    <section className="mt-4 ">
      <div>
        <h2 className="text-foreground text-lg font-semibold">
          Frequently Asked Questions
        </h2>
        <p className="text-muted-foreground text-sm text-balance ">
          Discover quick and comprehensive answers to common questions about our
          platform, services, and features.
        </p>
      </div>

      <div className="mt-4">
        <Accordion
          type="single"
          collapsible
          className="bg-card ring-foreground/5 rounded-3xl  w-full border border-transparent px-8 py-3 shadow ring-1"
        >
          {faqs.map((item) => (
            <AccordionItem
              key={item.q}
              value={item.q}
              className="border-dashed"
            >
              <AccordionTrigger className="cursor-pointer text-base hover:no-underline text-muted-foreground">
                {item.q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm">{item.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-muted-foreground text-sm mt-4">
          Can&apos;t find what you&apos;re looking for?{" "}
          <Link
            href="#"
            className="text-foreground font-medium hover:underline"
          >
            Contact our support team
          </Link>
        </p>
      </div>
    </section>
  );
}

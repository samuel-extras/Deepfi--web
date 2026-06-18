"use client";

/**
 * Market detail tabs — the strike ladder, live activity, comments, the
 * connected wallet's positions, and this market's top holders, consolidated
 * into one tabbed card below the chart. Built on shadcn Tabs (line variant).
 */
import PredictFeed from "@/components/prediction/PredictFeed";
import DemoBotsButton from "@/components/prediction/DemoBotsButton";
import { OracleComments } from "@/components/prediction/oracle/OracleComments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StrikeLadder from "./StrikeLadder";
import OraclePositions from "./OraclePositions";
import OracleTopHolders from "./OracleTopHolders";
import type { Direction, OracleDTO, Selection, SviResponse } from "./types";

const TABS = [
  ["ladder", "Strike ladder"],
  ["activity", "Activity"],
  ["comments", "Comments"],
  ["positions", "Positions"],
  ["holders", "Top holders"],
] as const;

export default function MarketTabs({
  oracle,
  spot,
  svi,
  sel,
  step,
  onSelectBinary,
  onSelectRange,
}: {
  oracle: OracleDTO;
  spot: number | null;
  svi?: SviResponse;
  sel: Selection;
  step: number;
  onSelectBinary: (strikeUsd: number, dir: Direction) => void;
  onSelectRange: (lowerUsd: number, higherUsd: number) => void;
}) {
  return (
    <Tabs
      defaultValue="ladder"
      className="gap-0 overflow-hidden rounded-xl border border-white/5 bg-card"
    >
      <TabsList
        variant="line"
        className="group-data-horizontal/tabs:h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-white/5 bg-transparent p-0"
      >
        {TABS.map(([id, label]) => (
          <TabsTrigger
            key={id}
            value={id}
            className="group-data-horizontal/tabs:after:bottom-0 h-auto flex-none rounded-none px-4 py-3 text-xs font-bold"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="ladder">
        <StrikeLadder
          bare
          oracle={oracle}
          spot={spot}
          svi={svi}
          sel={sel}
          step={step}
          onSelectBinary={onSelectBinary}
          onSelectRange={onSelectRange}
        />
      </TabsContent>

      <TabsContent value="activity" className="p-4">
        <div className="mb-3 flex justify-end">
          <DemoBotsButton />
        </div>
        <PredictFeed compact />
        <a
          href="/social"
          className="mt-3 block text-center text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          Full social feed →
        </a>
      </TabsContent>

      <TabsContent value="comments" className="p-4">
        <OracleComments oracleId={oracle.oracleId} />
      </TabsContent>

      <TabsContent value="positions">
        <OraclePositions oracle={oracle} />
      </TabsContent>

      <TabsContent value="holders">
        <OracleTopHolders oracleId={oracle.oracleId} />
      </TabsContent>
    </Tabs>
  );
}

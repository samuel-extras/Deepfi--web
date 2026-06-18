// DeepBook Predict — per-oracle page. Everything below is driven by the oracle
// in the URL param: a header, the live trading terminal (chart + ladder +
// ticket), resolution rules, an FAQ, and comments.
export const dynamic = "force-dynamic";

import PredictTerminal from "@/components/prediction/terminal/PredictTerminal";
import type { MirrorParams } from "@/components/prediction/terminal/PredictTerminal";
import { getOracleDetail } from "@/lib/predict";

export default async function OraclePage({
  params,
  searchParams,
}: {
  params: Promise<{ oracleId: string }>;
  searchParams?: Promise<{ low?: string; high?: string; size?: string }>;
}) {
  const { oracleId } = await params;
  const sp = await searchParams;
  const mirrorParams: MirrorParams = {
    size: sp?.size ? Number(sp.size) : null,
    low: sp?.low ? Number(sp.low) : null,
    high: sp?.high ? Number(sp.high) : null,
  };

  const detail = await getOracleDetail(oracleId);

  // Unknown oracle id → just the terminal (it surfaces its own empty state).
  if (!detail) {
    return <PredictTerminal oracleId={oracleId} mirrorParams={mirrorParams} />;
  }

  return (
    <div className="flex flex-col pb-16">
      <PredictTerminal
        oracleId={oracleId}
        mirrorParams={mirrorParams}
        hideBrand
        detail={detail}
      />
    </div>
  );
}

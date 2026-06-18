import { NextResponse } from "next/server";
import { indexer } from "@/lib/indexer";

export const revalidate = 3;

/** Indexer + oracle-feed health (for the health badge / monitor). */
export async function GET() {
  try {
    const status = await indexer.status();
    const maxLagMs = Math.max(
      0,
      ...status.pipelines.map((p) => p.time_lag_ms ?? 0),
    );
    return NextResponse.json({
      ok: status.status === "OK",
      latestCheckpoint: status.latest_onchain_checkpoint,
      maxCheckpointLag: status.max_checkpoint_lag,
      maxTimeLagSeconds: status.max_time_lag_seconds,
      maxLagMs,
      pipelines: status.pipelines.length,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}

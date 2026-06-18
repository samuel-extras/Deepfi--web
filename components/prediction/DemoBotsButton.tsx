"use client";

/**
 * "Demo Mode" trigger — nudges the configured bot wallets to place a round of
 * real Predict trades so the live feed isn't empty. Renders nothing unless
 * DEMO_BOT_KEYS is configured server-side (checked via GET /api/demo).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface DemoStatus {
  enabled: boolean;
  bots: { address: string; dusdcBalance: number }[];
}

export default function DemoBotsButton() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo")
      .then(r => r.json())
      .then((s: DemoStatus) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus({ enabled: false, bots: [] }); });
    return () => { cancelled = true; };
  }, []);

  // Hidden entirely when no bots are configured.
  if (!status?.enabled) return null;

  const funded = status.bots.filter(b => b.dusdcBalance > 0).length;

  async function runTick() {
    setRunning(true);
    const t = toast.loading("Demo bots trading…");
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "tick failed");
      toast.success(`${json.traded}/${json.total} demo bots traded — feed updating`, { id: t });
    } catch (e) {
      toast.error(`Demo tick failed: ${e instanceof Error ? e.message : e}`, { id: t });
    } finally {
      setRunning(false);
    }
  }

  return (
    <button
      onClick={runTick}
      disabled={running}
      title={`${status.bots.length} bots · ${funded} funded`}
      className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-violet-400 ${running ? "animate-pulse" : ""}`} />
      {running ? "Trading…" : "Demo Mode"}
    </button>
  );
}

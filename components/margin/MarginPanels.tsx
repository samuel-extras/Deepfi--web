"use client";

/**
 * Embeddable DeepBook Margin panels — margin-pool supply, your margin positions,
 * and a market risk monitor. Rendered beneath the trade screen on /margin so the
 * full chart + order book + order panel sit above the live margin data.
 * Reads from the DeepBook margin indexer (/api/deepbook/margin + /portfolio).
 */
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/useAuthStore";
import { DEV_ADDRESS } from "@/lib/sui/network";

type MarginResp = {
  ok: boolean;
  pools: { asset: string; supply: number }[];
  managers: { margin_manager_id: string }[];
  states: {
    margin_manager_id: string;
    base_asset_symbol: string;
    quote_asset_symbol: string;
    risk_ratio: string;
  }[];
};
type PortfolioResp = {
  margin_positions: {
    margin_manager_id: string;
    base_asset_symbol: string;
    quote_asset_symbol: string;
    total_debt_usd: number;
    net_value_usd: number;
    risk_ratio: number;
  }[];
};

const num = (n: number, d = 2) =>
  (n ?? 0).toLocaleString("en-US", { maximumFractionDigits: d });
const usd = (n: number) =>
  (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const short = (s: string) => (s ? `${s.slice(0, 6)}…${s.slice(-4)}` : "");

export default function MarginPanels() {
  const wallet = useAuthStore(s => s.userInfo.walletAddress) || DEV_ADDRESS;

  const marginQ = useQuery({
    queryKey: ["deepbook", "margin"],
    queryFn: async () =>
      (await fetch("/api/deepbook/margin", { cache: "no-store" }).then(r => r.json())) as MarginResp,
    refetchInterval: 15_000,
  });
  const portfolioQ = useQuery({
    queryKey: ["deepbook", "portfolio", wallet],
    queryFn: async () =>
      (await fetch(`/api/deepbook/portfolio?wallet=${wallet}`, { cache: "no-store" }).then(r => r.json())) as PortfolioResp,
    refetchInterval: 15_000,
  });

  const m = marginQ.data;
  const myPositions = portfolioQ.data?.margin_positions ?? [];
  const atRisk = [...(m?.states ?? [])]
    .sort((a, b) => Number(a.risk_ratio) - Number(b.risk_ratio))
    .slice(0, 6);

  return (
    <div className="border-t border-border px-4 py-5 lg:px-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Margin pools</h2>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`inline-block h-2 w-2 rounded-full ${m?.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
          {m?.managers?.length ?? 0} margin managers · deepbook_margin testnet
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(m?.pools ?? []).map(p => (
          <div key={p.asset} className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">{p.asset} supply</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{num(p.supply, 2)}</div>
            <div className="text-[10px] text-muted-foreground">available to borrow</div>
          </div>
        ))}
        {marginQ.isLoading && (
          <div className="text-sm text-muted-foreground">Loading pools…</div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* your positions */}
        <div>
          <h3 className="mb-2 text-sm font-medium text-foreground">Your margin positions</h3>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {portfolioQ.isLoading ? (
              <div className="p-5 text-sm text-muted-foreground">Loading…</div>
            ) : !myPositions.length ? (
              <div className="p-5 text-center text-sm text-muted-foreground">
                No open margin positions.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-normal">Pool</th>
                    <th className="px-4 py-2 font-normal">Net</th>
                    <th className="px-4 py-2 font-normal">Debt</th>
                    <th className="px-4 py-2 font-normal">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {myPositions.map(p => (
                    <tr key={p.margin_manager_id} className="border-t border-border">
                      <td className="px-4 py-2 text-foreground">{p.base_asset_symbol}/{p.quote_asset_symbol}</td>
                      <td className="px-4 py-2 text-foreground">{usd(p.net_value_usd)}</td>
                      <td className="px-4 py-2 text-foreground">{usd(p.total_debt_usd)}</td>
                      <td className="px-4 py-2"><Risk r={p.risk_ratio} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* risk monitor */}
        <div>
          <h3 className="mb-2 text-sm font-medium text-foreground">
            Risk monitor <span className="text-xs text-muted-foreground">(lowest ratios)</span>
          </h3>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {!atRisk.length ? (
              <div className="p-5 text-center text-sm text-muted-foreground">No active managers.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-normal">Pool</th>
                    <th className="px-4 py-2 font-normal">Risk ratio</th>
                    <th className="px-4 py-2 font-normal">Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.map(s => (
                    <tr key={s.margin_manager_id} className="border-t border-border">
                      <td className="px-4 py-2 text-foreground">{s.base_asset_symbol}/{s.quote_asset_symbol}</td>
                      <td className="px-4 py-2"><Risk r={Number(s.risk_ratio)} /></td>
                      <td className="px-4 py-2 text-muted-foreground">{short(s.margin_manager_id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Risk({ r }: { r: number }) {
  const color =
    r >= 1.5 ? "text-emerald-400 bg-emerald-500/15"
    : r >= 1.1 ? "text-amber-400 bg-amber-500/15"
    : "text-rose-400 bg-rose-500/15";
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${color}`}>
      {Number.isFinite(r) ? r.toFixed(2) : "—"}
    </span>
  );
}

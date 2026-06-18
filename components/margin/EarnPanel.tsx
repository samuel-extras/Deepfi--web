"use client";

/**
 * Earn — supply assets to the DeepBook margin lending pools and collect the
 * interest margin traders pay. One SupplierCap (minted automatically on first
 * supply) tracks positions across every pool.
 */
import { useState } from "react";
import { useCurrentAccount, ConnectModal } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/sui/deepbookSpot";
import { useWalletBalances } from "@/hooks/useDeepBookSpot";
import { useEarnActions, useEarnPools } from "@/hooks/useDeepBookMargin";

const SUI_GAS_RESERVE = 0.3;

export default function EarnPanel() {
  const address = useCurrentAccount()?.address;
  const { data: pools, isLoading } = useEarnPools();
  const { data: walletBal } = useWalletBalances();
  const { supply, withdraw, isPending, status } = useEarnActions();

  const [action, setAction] = useState<{
    kind: "supply" | "withdraw";
    coin: string;
  } | null>(null);
  const [amount, setAmount] = useState("");
  const amountNum = parseFloat(amount) || 0;

  const maxFor = (kind: "supply" | "withdraw", coin: string) => {
    if (kind === "withdraw")
      return pools?.find(p => p.coinKey === coin)?.mySupply ?? 0;
    const w = walletBal?.[coin] ?? 0;
    return coin === "SUI" ? Math.max(0, w - SUI_GAS_RESERVE) : w;
  };

  const run = async () => {
    if (!action || amountNum <= 0) return;
    const max = maxFor(action.kind, action.coin);
    if (action.kind === "supply") await supply(action.coin, amountNum);
    else await withdraw(action.coin, amountNum >= max - 1e-9 ? undefined : amountNum);
    setAction(null);
    setAmount("");
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">
          Earn · lend to margin traders
        </h3>
        <span className="text-[11px] text-muted-foreground">
          interest accrues per block, withdraw anytime liquidity allows
        </span>
      </div>

      {isLoading ? (
        <div className="p-4 text-sm text-muted-foreground">Loading lending pools…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-normal">Asset</th>
                <th className="px-4 py-2 text-right font-normal">Borrow APR</th>
                <th className="px-4 py-2 text-right font-normal">Utilization</th>
                <th className="px-4 py-2 text-right font-normal">Pool supply</th>
                <th className="px-4 py-2 text-right font-normal">You supplied</th>
                <th className="px-4 py-2 text-right font-normal" />
              </tr>
            </thead>
            <tbody>
              {(pools ?? []).map(p => (
                <tr key={p.coinKey} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2 font-medium text-foreground">{p.coinKey}</td>
                  <td className="px-4 py-2 text-right text-emerald-400">
                    {formatAmount(p.borrowAprPct, 1)}%
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">
                    {formatAmount(p.utilizationPct, 0)}%
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">
                    {formatAmount(p.totalSupply, 2)}
                  </td>
                  <td className="px-4 py-2 text-right text-foreground">
                    {p.mySupply > 0 ? formatAmount(p.mySupply, 4) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2 text-xs">
                      <button
                        className="text-muted-foreground hover:text-emerald-400"
                        onClick={() => {
                          setAction({ kind: "supply", coin: p.coinKey });
                          setAmount("");
                        }}
                      >
                        Supply
                      </button>
                      {p.mySupply > 0 && (
                        <button
                          className="text-muted-foreground hover:text-rose-400"
                          onClick={() => {
                            setAction({ kind: "withdraw", coin: p.coinKey });
                            setAmount("");
                          }}
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {action && (
        <div className="border-t border-border p-4">
          <div className="mb-2 text-xs text-muted-foreground">
            {action.kind === "supply" ? "Supply to" : "Withdraw from"} the{" "}
            {action.coin} pool — max {formatAmount(maxFor(action.kind, action.coin), 6)}{" "}
            {action.coin}
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
              <input
                inputMode="decimal"
                autoFocus
                placeholder="0.0"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="w-full bg-transparent text-sm text-foreground outline-none"
              />
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setAmount(String(maxFor(action.kind, action.coin)))}
              >
                MAX
              </button>
            </div>
            {!address ? (
              <ConnectModal
                trigger={
                  <Button type="button" size="sm">
                    Connect wallet
                  </Button>
                }
              />
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={
                  isPending ||
                  amountNum <= 0 ||
                  amountNum > maxFor(action.kind, action.coin) + 1e-9
                }
                onClick={run}
              >
                {isPending
                  ? status ?? "Working…"
                  : action.kind === "supply"
                    ? "Supply"
                    : "Withdraw"}
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => setAction(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

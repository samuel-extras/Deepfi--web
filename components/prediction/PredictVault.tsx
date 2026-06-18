"use client";

/**
 * DeepBook Predict — Vault / PLP LP interface.
 *
 * Shows vault stats from /api/svi and lets liquidity providers:
 *   - Supply dUSDC to the vault and receive PLP shares
 *   - Withdraw by burning PLP shares
 *
 * The vault is the counterparty to every Predict trade. PLP holders earn
 * from the spread and lose when many positions expire in-the-money.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { toast } from "sonner";
import { COIN_TYPES, OBJECTS, TARGETS, DUSDC_FAUCET_URL } from "@/lib/deepbook";
import type { VaultSummary } from "@/lib/indexer";
import { Transaction } from "@mysten/sui/transactions";
import FundingBar from "@/components/wallet/FundingBar";
import VaultSimulation from "@/components/prediction/VaultSimulation";

// ─── PTB helpers (inline — vault supply/withdraw don't need a manager) ─────────
function buildSupplyTx(dusdcCoinId: string, amountRaw: string, sender: string): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.object(dusdcCoinId), [tx.pure.u64(amountRaw)]);
  const lp = tx.moveCall({
    target: TARGETS.supply,
    typeArguments: [COIN_TYPES.dusdc],
    arguments: [tx.object(OBJECTS.predict), coin, tx.object(OBJECTS.clock)],
  });
  tx.transferObjects([lp], tx.pure.address(sender));
  return tx;
}

function buildWithdrawTx(plpCoinId: string, sender: string): Transaction {
  const tx = new Transaction();
  const coin = tx.moveCall({
    target: TARGETS.withdraw,
    typeArguments: [COIN_TYPES.dusdc],
    arguments: [
      tx.object(OBJECTS.predict),
      tx.object(plpCoinId),
      tx.object(OBJECTS.clock),
    ],
  });
  tx.transferObjects([coin], tx.pure.address(sender));
  return tx;
}

// ─── component ────────────────────────────────────────────────────────────────
export default function PredictVault() {
  const account = useCurrentAccount();
  const owner = account?.address;
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [supplyAmount, setSupplyAmount] = useState("10");
  const [isPending, setIsPending] = useState(false);

  // vault summary from indexer
  const vaultQ = useQuery({
    queryKey: ["predict", "vault"],
    queryFn: () =>
      fetch(`https://predict-server.testnet.mystenlabs.com/predicts/${OBJECTS.predict}/vault/summary`, {
        headers: { accept: "application/json" },
      }).then(r => r.json()),
    refetchInterval: 30_000,
  });

  // user's PLP balance
  const plpQ = useSuiClientQuery(
    "getBalance",
    { owner: owner ?? "", coinType: COIN_TYPES.plp },
    { enabled: !!owner, refetchInterval: 15_000 },
  );

  // Live /vault/summary shape (vault_balance, utilization, plp_share_price, …).
  const vault = vaultQ.data as Partial<VaultSummary> | undefined;

  const plpBalance = Number(plpQ.data?.totalBalance ?? 0);
  const hasPLP = plpBalance > 0;

  const supply = async () => {
    if (!owner) return toast.error("Connect your wallet");
    const amt = Number(supplyAmount);
    if (!(amt > 0)) return toast.error("Enter an amount");
    setIsPending(true);
    try {
      const { data: coins } = await client.getCoins({ owner, coinType: COIN_TYPES.dusdc });
      if (!coins.length) throw new Error("No dUSDC — get some from the faucet first");
      const total = coins.reduce((s, c) => s + Number(c.balance), 0);
      const amtRaw = String(Math.round(amt * 1_000_000));
      if (total < Number(amtRaw)) throw new Error(`Insufficient dUSDC (have ${(total / 1e6).toFixed(2)})`);
      // merge if multiple coins
      let txForSupply: Transaction;
      if (coins.length > 1) {
        const mergeTx = new Transaction();
        const [primary, ...rest] = coins;
        mergeTx.mergeCoins(mergeTx.object(primary.coinObjectId), rest.map(c => mergeTx.object(c.coinObjectId)));
        const res = await signAndExecute({ transaction: mergeTx });
        await client.waitForTransaction({ digest: res.digest });
        const refreshed = await client.getCoins({ owner, coinType: COIN_TYPES.dusdc });
        txForSupply = buildSupplyTx(refreshed.data[0].coinObjectId, amtRaw, owner);
      } else {
        txForSupply = buildSupplyTx(coins[0].coinObjectId, amtRaw, owner);
      }
      const res = await signAndExecute({ transaction: txForSupply });
      await client.waitForTransaction({ digest: res.digest });
      toast.success(`Supplied ${amt} dUSDC to vault · received PLP shares`);
      void plpQ.refetch();
    } catch (e) {
      toast.error(`Supply failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`);
    } finally {
      setIsPending(false);
    }
  };

  const withdraw = async () => {
    if (!owner) return toast.error("Connect your wallet");
    if (!hasPLP) return toast.error("No PLP to withdraw");
    setIsPending(true);
    try {
      const { data: plpCoins } = await client.getCoins({ owner, coinType: COIN_TYPES.plp });
      if (!plpCoins.length) throw new Error("No PLP coins found");
      const tx = buildWithdrawTx(plpCoins[0].coinObjectId, owner);
      const res = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: res.digest });
      toast.success("Withdrew from vault · dUSDC returned to wallet");
      void plpQ.refetch();
    } catch (e) {
      toast.error(`Withdraw failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`);
    } finally {
      setIsPending(false);
    }
  };

  const fmtU6 = (n?: number) =>
    n == null ? "—" : `$${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const fmtPLP = (n: number) =>
    n === 0 ? "0" : (n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 4 });

  // Server-computed utilization (fraction 0..1) — don't recompute locally.
  const utilizationPct = vault?.utilization != null ? vault.utilization * 100 : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Predict Vault</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Supply dUSDC to the shared vault. The vault takes the opposite side of every Predict
          trade. Earn from spread and utilization; PLP shares represent your proportional claim.
        </p>
      </div>

      <FundingBar />

      {/* vault stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Vault balance" value={fmtU6(vault?.vault_balance)} loading={vaultQ.isLoading} />
        <StatCard label="Vault value" value={fmtU6(vault?.vault_value)} loading={vaultQ.isLoading} hint="after liabilities" />
        <StatCard label="Total MTM" value={fmtU6(vault?.total_mtm)} loading={vaultQ.isLoading} hint="mark-to-market" />
        <StatCard
          label="Utilization"
          value={utilizationPct != null ? `${utilizationPct.toFixed(1)}%` : "—"}
          loading={vaultQ.isLoading}
          color={utilizationPct != null && utilizationPct > 80 ? "rose" : "emerald"}
        />
        <StatCard
          label="PLP share price"
          value={vault?.plp_share_price != null ? `$${vault.plp_share_price.toFixed(4)}` : "—"}
          loading={vaultQ.isLoading}
          hint="dUSDC per PLP"
        />
        <StatCard
          label="Available withdrawal"
          value={fmtU6(vault?.available_withdrawal)}
          loading={vaultQ.isLoading}
          hint="withdrawal limiter"
        />
      </div>

      {/* my PLP balance */}
      {owner ? (
        <div className="mb-6 rounded-lg border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">My PLP balance</div>
            <div className="mt-1 text-xl font-semibold text-foreground">
              {plpQ.isLoading ? "…" : fmtPLP(plpBalance)}{" "}
              <span className="text-sm font-normal text-muted-foreground">PLP</span>
            </div>
          </div>
          <button
            onClick={withdraw}
            disabled={isPending || !hasPLP}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "…" : "Withdraw"}
          </button>
        </div>
      ) : null}

      {/* supply form */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-base font-semibold">Supply liquidity</h2>

        <label className="mb-1 block text-xs text-muted-foreground">Amount (dUSDC)</label>
        <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5">
          <input
            type="number"
            min="0"
            step="1"
            value={supplyAmount}
            onChange={e => setSupplyAmount(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground outline-none"
            placeholder="Enter amount…"
          />
          <span className="text-xs text-muted-foreground">dUSDC</span>
        </div>

        <button
          onClick={supply}
          disabled={isPending || !owner}
          className="w-full rounded-md bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!owner ? "Connect wallet to supply" : isPending ? "Processing…" : "Supply & receive PLP"}
        </button>

        {!owner ? null : (
          <p className="mt-3 text-[11px] text-muted-foreground text-center">
            PLP shares represent a proportional claim on vault value.{" "}
            <a href={DUSDC_FAUCET_URL} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
              Get dUSDC
            </a>
          </p>
        )}
      </div>

      {/* how it works */}
      <div className="mt-6 rounded-lg border border-border bg-card/50 p-4 text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-foreground text-sm">How the vault works</p>
        <p>Every Predict mint flows money <em>into</em> the vault. Every redeem flows money <em>out</em>. PLP holders collectively take the other side of every trade.</p>
        <p>Withdrawals are subject to the withdrawal limiter — you can withdraw up to the vault balance minus the current maximum payout obligation.</p>
        <p>First supplier mints PLP 1:1. Later suppliers receive PLP proportional to their deposit vs current vault value.</p>
      </div>

      {/* Strategy backtest — "proper simulation result" for the vault strategies */}
      <div className="mt-8 border-t border-border pt-6">
        <VaultSimulation />
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Not financial advice. Testnet only.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  loading,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
  color?: "emerald" | "rose";
}) {
  const colorClass = color === "emerald" ? "text-emerald-400" : color === "rose" ? "text-rose-400" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-base font-semibold ${colorClass}`}>
        {loading ? <span className="animate-pulse">—</span> : value}
      </div>
      {hint ? <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

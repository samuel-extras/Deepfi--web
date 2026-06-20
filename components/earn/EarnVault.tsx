"use client";

/**
 * Earn — DeepBook-native yield.
 *
 * The one real "earn" product on testnet: supply dUSDC to the DeepBook Predict
 * PLP vault and receive PLP shares. The vault is the counterparty to every
 * Predict trade, so PLP holders earn the protocol spread + utilization.
 *
 * Live economics (TVL, share price, utilization, APY) come straight from the
 * public predict-server; APY is annualized from the vault's real PLP
 * share-price history. Supply is a single on-chain `predict::supply`.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSuiClient, useSuiClientQuery } from "@mysten/dapp-kit";
import { useSignAndExecuteTransaction } from "@/lib/zklogin/useSponsoredExecute";
import { Transaction } from "@mysten/sui/transactions";
import { toast } from "sonner";
import {
  COIN_TYPES,
  OBJECTS,
  PREDICT_INDEXER_URL,
  TARGETS,
  DUSDC_FAUCET_URL,
} from "@/lib/deepbook";
import type { VaultSummary } from "@/lib/indexer";
import Link from "next/link";
import HedgedPlp from "@/components/prediction/hedge/HedgedPlp";

const VAULT_BASE = `${PREDICT_INDEXER_URL}/predicts/${OBJECTS.predict}/vault`;
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

interface PerfPoint {
  timestamp_ms: number;
  share_price: number;
  vault_value: number;
  total_shares: number;
}

/** Annualize PLP return from the real share-price history (first → last). */
function computeApy(points: PerfPoint[] | undefined): number | null {
  if (!points || points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (!(first.share_price > 0) || !(last.share_price > 0)) return null;
  const years = (last.timestamp_ms - first.timestamp_ms) / MS_PER_YEAR;
  if (years <= 0) return null;
  const apy = Math.pow(last.share_price / first.share_price, 1 / years) - 1;
  if (!Number.isFinite(apy)) return null;
  // Clamp the testnet sample so a noisy short window can't render absurd values.
  return Math.max(-0.99, Math.min(apy, 9.99));
}

function buildSupplyTx(
  dusdcCoinId: string,
  amountRaw: string,
  sender: string,
): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.object(dusdcCoinId), [
    tx.pure.u64(amountRaw),
  ]);
  const lp = tx.moveCall({
    target: TARGETS.supply,
    typeArguments: [COIN_TYPES.dusdc],
    arguments: [tx.object(OBJECTS.predict), coin, tx.object(OBJECTS.clock)],
  });
  tx.transferObjects([lp], tx.pure.address(sender));
  return tx;
}

const fmtU6 = (n?: number) =>
  n == null
    ? "—"
    : `$${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function EarnVault() {
  const account = useActiveAccount();
  const owner = account?.address;
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [amount, setAmount] = useState("10");
  const [isPending, setIsPending] = useState(false);

  const summaryQ = useQuery({
    queryKey: ["earn", "vault", "summary"],
    queryFn: () =>
      fetch(`${VAULT_BASE}/summary`, {
        headers: { accept: "application/json" },
      }).then((r) => r.json() as Promise<VaultSummary>),
    refetchInterval: 30_000,
  });

  const perfQ = useQuery({
    queryKey: ["earn", "vault", "performance"],
    queryFn: () =>
      fetch(`${VAULT_BASE}/performance?range=ALL`, {
        headers: { accept: "application/json" },
      })
        .then((r) => r.json())
        .then((d) => (d?.points ?? []) as PerfPoint[]),
    refetchInterval: 60_000,
  });

  const plpQ = useSuiClientQuery(
    "getBalance",
    { owner: owner ?? "", coinType: COIN_TYPES.plp },
    { enabled: !!owner, refetchInterval: 15_000 },
  );

  const vault = summaryQ.data;
  const apy = useMemo(() => computeApy(perfQ.data), [perfQ.data]);
  const plpBalance = Number(plpQ.data?.totalBalance ?? 0);
  const utilizationPct =
    vault?.utilization != null ? vault.utilization * 100 : null;

  const supply = async () => {
    if (!owner) return toast.error("Connect your wallet");
    const amt = Number(amount);
    if (!(amt > 0)) return toast.error("Enter an amount");
    setIsPending(true);
    try {
      const { data: coins } = await client.getCoins({
        owner,
        coinType: COIN_TYPES.dusdc,
      });
      if (!coins.length)
        throw new Error("No dUSDC — get some from the faucet first");
      const total = coins.reduce((s, c) => s + Number(c.balance), 0);
      const amtRaw = String(Math.round(amt * 1_000_000));
      if (total < Number(amtRaw))
        throw new Error(
          `Insufficient dUSDC (have ${(total / 1e6).toFixed(2)})`,
        );

      let coinId = coins[0].coinObjectId;
      if (coins.length > 1) {
        const mergeTx = new Transaction();
        const [primary, ...rest] = coins;
        mergeTx.mergeCoins(
          mergeTx.object(primary.coinObjectId),
          rest.map((c) => mergeTx.object(c.coinObjectId)),
        );
        const res = await signAndExecute({ transaction: mergeTx });
        await client.waitForTransaction({ digest: res.digest });
        const refreshed = await client.getCoins({
          owner,
          coinType: COIN_TYPES.dusdc,
        });
        coinId = refreshed.data[0].coinObjectId;
      }

      const res = await signAndExecute({
        transaction: buildSupplyTx(coinId, amtRaw, owner),
      });
      await client.waitForTransaction({ digest: res.digest });
      toast.success(`Supplied ${amt} dUSDC · received PLP shares`);
      void plpQ.refetch();
      void summaryQ.refetch();
    } catch (e) {
      toast.error(
        `Supply failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`,
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
            DeepBook Predict · PLP
          </span>
          <h1 className="text-2xl font-semibold">Earn</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Supply dUSDC to the DeepBook Predict vault — the counterparty to every
          Predict trade — and earn the protocol spread &amp; utilization. Your
          PLP shares are a proportional claim on vault value, redeemable any
          time.
        </p>
      </div>

      {/* live economics */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Est. APY"
          value={apy != null ? `${(apy * 100).toFixed(1)}%` : "—"}
          hint="annualized from share price"
          color="emerald"
          loading={perfQ.isLoading}
        />
        <Stat
          label="TVL"
          value={fmtU6(vault?.vault_value)}
          hint="vault value"
          loading={summaryQ.isLoading}
        />
        <Stat
          label="PLP share price"
          value={
            vault?.plp_share_price != null
              ? `$${vault.plp_share_price.toFixed(4)}`
              : "—"
          }
          hint="dUSDC per PLP"
          loading={summaryQ.isLoading}
        />
        <Stat
          label="Utilization"
          value={utilizationPct != null ? `${utilizationPct.toFixed(1)}%` : "—"}
          hint="vault in use"
          color={
            utilizationPct != null && utilizationPct > 80 ? "rose" : undefined
          }
          loading={summaryQ.isLoading}
        />
      </div>

      {/* supply card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Supply liquidity</h2>
          {owner ? (
            <span className="text-xs text-muted-foreground">
              Your PLP:{" "}
              <span className="font-medium text-foreground">
                {plpQ.isLoading
                  ? "…"
                  : (plpBalance / 1_000_000).toLocaleString("en-US", {
                      maximumFractionDigits: 4,
                    })}
              </span>
            </span>
          ) : null}
        </div>

        <label className="mb-1 block text-xs text-muted-foreground">
          Amount (dUSDC)
        </label>
        <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5">
          <input
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
          {!owner
            ? "Connect wallet to supply"
            : isPending
              ? "Processing…"
              : "Supply & receive PLP"}
        </button>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Withdraw any time + see PLP strategy backtests in the{" "}
          <Link
            href="/prediction/vault"
            className="text-emerald-400 hover:underline"
          >
            full Vault →
          </Link>
          {" · "}
          <Link
            href={DUSDC_FAUCET_URL}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:underline"
          >
            Get dUSDC
          </Link>
        </p>
      </div>

      <HedgedPlp />

      {/* how it works */}
      <div className="mt-6 rounded-lg border border-border bg-card/50 p-4 text-xs text-muted-foreground space-y-2">
        <p className="text-sm font-medium text-foreground">How you earn</p>
        <p>
          Every Predict mint flows premium <em>into</em> the vault; every redeem
          flows it
          <em> out</em>. PLP holders collectively take the other side of every
          trade and keep the spread. The share price rises as the vault accrues
          fees.
        </p>
        <p>
          Withdrawals are bounded by the on-chain withdrawal limiter (vault
          balance minus the current max-payout obligation), so the vault can
          always honor open positions.
        </p>
        <p className="text-[11px]">Not financial advice. Testnet only.</p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  color,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: "emerald" | "rose";
  loading?: boolean;
}) {
  const c =
    color === "emerald"
      ? "text-emerald-400"
      : color === "rose"
        ? "text-rose-400"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-base font-semibold ${c}`}>
        {loading ? <span className="animate-pulse">—</span> : value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

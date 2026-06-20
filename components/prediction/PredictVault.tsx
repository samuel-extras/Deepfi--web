"use client";

/**
 * DeepBook Predict — Vault / PLP LP interface, laid out like a savings/vault
 * detail page (hero stats, About/Performance, a performance chart, and a
 * positions table). Supply and withdraw happen in a responsive modal.
 *
 * The vault is the counterparty to every Predict trade. PLP holders earn from
 * the spread and lose when many positions expire in-the-money.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useSuiClient, useSuiClientQuery } from "@mysten/dapp-kit";
import { useSignAndExecuteTransaction } from "@/lib/zklogin/useSponsoredExecute";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import { COIN_TYPES, OBJECTS, TARGETS, DUSDC_FAUCET_URL } from "@/lib/deepbook";
import type { VaultSummary } from "@/lib/indexer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";
import FundingBar from "@/components/wallet/FundingBar";
import VaultSimulation from "@/components/prediction/VaultSimulation";

// ─── PTB helpers (inline — vault supply/withdraw don't need a manager) ─────────
function buildSupplyTx(
  dusdcCoinId: string,
  amountRaw: string,
  sender: string,
): Transaction {
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
  const account = useActiveAccount();
  const owner = account?.address;
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [supplyAmount, setSupplyAmount] = useState("10");
  const [isPending, setIsPending] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // vault summary from indexer
  const vaultQ = useQuery({
    queryKey: ["predict", "vault"],
    queryFn: () =>
      fetch(
        `https://predict-server.testnet.mystenlabs.com/predicts/${OBJECTS.predict}/vault/summary`,
        { headers: { accept: "application/json" } },
      ).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  // user's PLP balance
  const plpQ = useSuiClientQuery(
    "getBalance",
    { owner: owner ?? "", coinType: COIN_TYPES.plp },
    { enabled: !!owner, refetchInterval: 15_000 },
  );

  const vault = vaultQ.data as Partial<VaultSummary> | undefined;
  const plpBalance = Number(plpQ.data?.totalBalance ?? 0);
  const hasPLP = plpBalance > 0;
  const sharePrice = vault?.plp_share_price ?? null;
  const myDepositUsd =
    sharePrice != null ? (plpBalance / 1_000_000) * sharePrice : null;

  const supply = async () => {
    if (!owner) return toast.error("Connect your wallet");
    const amt = Number(supplyAmount);
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
        throw new Error(`Insufficient dUSDC (have ${(total / 1e6).toFixed(2)})`);
      let txForSupply: Transaction;
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
        txForSupply = buildSupplyTx(refreshed.data[0].coinObjectId, amtRaw, owner);
      } else {
        txForSupply = buildSupplyTx(coins[0].coinObjectId, amtRaw, owner);
      }
      const res = await signAndExecute({ transaction: txForSupply });
      await client.waitForTransaction({ digest: res.digest });
      toast.success(`Supplied ${amt} dUSDC to vault · received PLP shares`);
      setDepositOpen(false);
      void plpQ.refetch();
      void vaultQ.refetch();
    } catch (e) {
      toast.error(
        `Supply failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`,
      );
    } finally {
      setIsPending(false);
    }
  };

  const withdraw = async () => {
    if (!owner) return toast.error("Connect your wallet");
    if (!hasPLP) return toast.error("No PLP to withdraw");
    setIsPending(true);
    try {
      const { data: plpCoins } = await client.getCoins({
        owner,
        coinType: COIN_TYPES.plp,
      });
      if (!plpCoins.length) throw new Error("No PLP coins found");
      const tx = buildWithdrawTx(plpCoins[0].coinObjectId, owner);
      const res = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: res.digest });
      toast.success("Withdrew from vault · dUSDC returned to wallet");
      setWithdrawOpen(false);
      void plpQ.refetch();
      void vaultQ.refetch();
    } catch (e) {
      toast.error(
        `Withdraw failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`,
      );
    } finally {
      setIsPending(false);
    }
  };

  const fmtU6 = (n?: number | null) =>
    n == null
      ? "—"
      : `$${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const fmtPLP = (n: number) =>
    n === 0
      ? "0"
      : (n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 4 });

  const utilizationPct = vault?.utilization != null ? vault.utilization * 100 : null;

  const metrics = [
    { label: "Vault balance", value: fmtU6(vault?.vault_balance) },
    { label: "Vault value", value: fmtU6(vault?.vault_value), hint: "after liabilities" },
    { label: "Total MTM", value: fmtU6(vault?.total_mtm), hint: "mark-to-market" },
    {
      label: "Utilization",
      value: utilizationPct != null ? `${utilizationPct.toFixed(1)}%` : "—",
      color: utilizationPct != null && utilizationPct > 80 ? "rose" : undefined,
    },
    {
      label: "PLP share price",
      value: sharePrice != null ? `$${sharePrice.toFixed(4)}` : "—",
      hint: "dUSDC per PLP",
    },
    {
      label: "Available withdrawal",
      value: fmtU6(vault?.available_withdrawal),
      hint: "withdrawal limiter",
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-360 px-4 py-6 xl:px-10">
      {/* breadcrumb */}
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/prediction" className="hover:text-foreground">
          Predict
        </Link>
        <span>›</span>
        <span className="text-foreground">Vault (PLP)</span>
      </nav>

      {/* header: title + address · actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">Predict Vault</h1>
          <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="truncate font-mono">{OBJECTS.predict}</span>
            <CopyButton text={OBJECTS.predict} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={() => setDepositOpen(true)}
            className="gap-1.5 rounded-full px-5"
          >
            <ArrowDownToLine className="size-4" /> Deposit
          </Button>
          <Button
            variant="outline"
            onClick={() => setWithdrawOpen(true)}
            className="gap-1.5 rounded-full px-5"
          >
            <ArrowUpFromLine className="size-4" /> Withdraw
          </Button>
        </div>
      </div>

      {/* hero stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HeroStat
          label="TVL"
          value={fmtU6(vault?.vault_value)}
          loading={vaultQ.isLoading}
        />
        <HeroStat
          label="Utilization"
          value={utilizationPct != null ? `${utilizationPct.toFixed(1)}%` : "—"}
          loading={vaultQ.isLoading}
          color={
            utilizationPct != null && utilizationPct > 80 ? "rose" : "emerald"
          }
        />
        <HeroStat
          label="Your Deposits"
          value={!owner ? "N/A" : myDepositUsd != null ? fmtU6(myDepositUsd * 1_000_000) : "—"}
          sub={owner && hasPLP ? `${fmtPLP(plpBalance)} PLP` : undefined}
        />
        <HeroStat
          label="PLP Share Price"
          value={sharePrice != null ? `$${sharePrice.toFixed(4)}` : "—"}
          loading={vaultQ.isLoading}
          color="emerald"
        />
      </div>

      {/* two-column: About/Performance · chart */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* left — About / Performance */}
        <div className="rounded-2xl border border-white/5 bg-card p-5">
          <Tabs defaultValue="about">
            <TabsList variant="line" className="mb-3 bg-transparent p-0">
              <TabsTrigger value="about" className="px-1.5">
                About
              </TabsTrigger>
              <TabsTrigger value="performance" className="px-1.5">
                Performance
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="about"
              className="space-y-4 text-sm text-muted-foreground"
            >
              <p>
                The Predict Vault lets you earn yield by supplying dUSDC into
                DeepBook Predict&apos;s liquidity pool (PLP). Your funds take the
                other side of every prediction trade, and you earn a share of
                what the pool collects.
              </p>
              <ul className="space-y-1.5">
                {[
                  "Spread captured on every mint and redeem",
                  "Utilization-based premia from open positions",
                  "First-loss capital — counterparty to all trades",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {b}
                  </li>
                ))}
              </ul>
              <p>
                You can supply or withdraw anytime; your PLP balance updates
                automatically as the pool earns. PLP shares represent a
                proportional claim on vault value.
              </p>
            </TabsContent>

            <TabsContent value="performance">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {metrics.map((m) => (
                  <Metric
                    key={m.label}
                    label={m.label}
                    value={m.value}
                    hint={"hint" in m ? m.hint : undefined}
                    color={"color" in m ? m.color : undefined}
                    loading={vaultQ.isLoading}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* right — performance chart (real backtest) */}
        <div className="rounded-2xl border border-white/5 bg-card p-5">
          <VaultSimulation />
        </div>
      </div>

      {/* positions / how-it-works table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-card">
        <Tabs defaultValue="position">
          <TabsList
            variant="line"
            className="w-full justify-start gap-0 rounded-none border-b border-white/5 bg-transparent p-0"
          >
            <TabsTrigger value="position" className="rounded-none px-4 py-3">
              Your Position
            </TabsTrigger>
            <TabsTrigger value="how" className="rounded-none px-4 py-3">
              How it works
            </TabsTrigger>
          </TabsList>

          <TabsContent value="position" className="p-0">
            {!owner ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Connect your wallet to view your position.
              </div>
            ) : !hasPLP ? (
              <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  You have no PLP yet.
                </p>
                <Button
                  onClick={() => setDepositOpen(true)}
                  className="rounded-full px-5"
                >
                  Deposit dUSDC
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Asset</th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      Balance
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      USD Value
                    </th>
                    <th className="px-5 py-2.5 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-5 py-3.5 font-medium">PLP</td>
                    <td className="px-3 py-3.5 text-right font-mono">
                      {fmtPLP(plpBalance)}
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono">
                      {myDepositUsd != null
                        ? fmtU6(myDepositUsd * 1_000_000)
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => setWithdrawOpen(true)}
                      >
                        Withdraw
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </TabsContent>

          <TabsContent
            value="how"
            className="space-y-2 p-5 text-xs text-muted-foreground"
          >
            <p>
              Every Predict mint flows money <em>into</em> the vault. Every
              redeem flows money <em>out</em>. PLP holders collectively take the
              other side of every trade.
            </p>
            <p>
              Withdrawals are subject to the withdrawal limiter — you can
              withdraw up to the vault balance minus the current maximum payout
              obligation.
            </p>
            <p>
              First supplier mints PLP 1:1. Later suppliers receive PLP
              proportional to their deposit vs current vault value.
            </p>
          </TabsContent>
        </Tabs>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Not financial advice. Testnet only.
      </p>

      {/* ── Deposit modal ── */}
      <ResponsiveModal open={depositOpen} onOpenChange={setDepositOpen}>
        <ResponsiveModalContent className="sm:max-w-[420px]">
          <ResponsiveModalHeader className="text-left">
            <ResponsiveModalTitle>Supply liquidity</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Supply dUSDC to the vault and receive PLP shares.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <div className="space-y-4 px-4 pb-4 md:px-0 md:pb-0">
            <FundingBar />
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Amount (dUSDC)
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={supplyAmount}
                  onChange={(e) => setSupplyAmount(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                  placeholder="Enter amount…"
                  autoFocus
                />
                <span className="text-xs text-muted-foreground">dUSDC</span>
              </div>
            </div>

            <Button
              onClick={supply}
              disabled={isPending || !owner}
              className="w-full rounded-full"
            >
              {!owner
                ? "Connect wallet to supply"
                : isPending
                  ? "Processing…"
                  : "Supply & receive PLP"}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              PLP shares represent a proportional claim on vault value.{" "}
              <a
                href={DUSDC_FAUCET_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                Get dUSDC <ExternalLink className="size-3" />
              </a>
            </p>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ── Withdraw modal ── */}
      <ResponsiveModal open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <ResponsiveModalContent className="sm:max-w-[420px]">
          <ResponsiveModalHeader className="text-left">
            <ResponsiveModalTitle>Withdraw liquidity</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Burn your PLP shares to redeem dUSDC from the vault.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <div className="space-y-4 px-4 pb-4 md:px-0 md:pb-0">
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your PLP balance</span>
                <span className="font-mono font-semibold">
                  {fmtPLP(plpBalance)} PLP
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Est. value</span>
                <span className="font-mono">
                  {myDepositUsd != null ? fmtU6(myDepositUsd * 1_000_000) : "—"}
                </span>
              </div>
            </div>

            <Button
              onClick={withdraw}
              disabled={isPending || !owner || !hasPLP}
              variant="outline"
              className="w-full rounded-full"
            >
              {!owner
                ? "Connect wallet"
                : !hasPLP
                  ? "No PLP to withdraw"
                  : isPending
                    ? "Processing…"
                    : "Withdraw all"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Subject to the withdrawal limiter.
            </p>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
      aria-label="Copy address"
    >
      {copied ? (
        <Check className="size-3.5 text-primary" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

function HeroStat({
  label,
  value,
  sub,
  loading,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
  color?: "emerald" | "rose";
}) {
  const colorClass =
    color === "emerald"
      ? "text-primary"
      : color === "rose"
        ? "text-rose-400"
        : "text-foreground";
  return (
    <div className="rounded-2xl border border-white/5 bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1.5 text-xl font-bold tabular-nums", colorClass)}>
        {loading ? <span className="animate-pulse opacity-60">—</span> : value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  color,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: "rose";
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-background/40 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-sm font-semibold tabular-nums",
          color === "rose" ? "text-rose-400" : "text-foreground",
        )}
      >
        {loading ? <span className="animate-pulse opacity-60">—</span> : value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

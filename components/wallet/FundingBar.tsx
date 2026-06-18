"use client";

/**
 * Funding / onboarding helper. Shows the connected wallet's SUI (gas) + dUSDC
 * (Predict quote) balances and one-tap ways to fund:
 *   - "Get SUI"   → programmatic testnet gas faucet
 *   - "Get dUSDC" → the DeepBook Predict dUSDC faucet form
 * When disconnected it prompts to connect; when dUSDC is 0 it highlights the
 * faucet so a user can actually reach a mint.
 */
import { useState } from "react";
import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { getFaucetHost, requestSuiFromFaucetV2 } from "@mysten/sui/faucet";
import { toast } from "sonner";
import { COIN_TYPES, DUSDC_FAUCET_URL } from "@/lib/deepbook";

const fmt = (raw: string | undefined, decimals: number, dp = 4) =>
  raw == null
    ? "—"
    : (Number(raw) / 10 ** decimals).toLocaleString("en-US", {
        maximumFractionDigits: dp,
      });

export default function FundingBar() {
  const account = useCurrentAccount();
  const owner = account?.address;
  const [requesting, setRequesting] = useState(false);

  const suiQ = useSuiClientQuery(
    "getBalance",
    { owner: owner ?? "", coinType: "0x2::sui::SUI" },
    { enabled: !!owner, refetchInterval: 15_000 }
  );
  const dusdcQ = useSuiClientQuery(
    "getBalance",
    { owner: owner ?? "", coinType: COIN_TYPES.dusdc },
    { enabled: !!owner, refetchInterval: 15_000 }
  );

  const dusdcZero = (dusdcQ.data?.totalBalance ?? "0") === "0";

  const getSui = async () => {
    if (!owner) return;
    setRequesting(true);
    try {
      await requestSuiFromFaucetV2({ host: getFaucetHost("testnet"), recipient: owner });
      toast.success("Requested testnet SUI — balance updates shortly");
      setTimeout(() => suiQ.refetch(), 3000);
    } catch (e) {
      toast.error(`SUI faucet: ${(e instanceof Error ? e.message : String(e)).slice(0, 120)}`);
    } finally {
      setRequesting(false);
    }
  };

  if (!owner) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          Connect your wallet to view balances and fund your account.
        </span>
        <span className="text-xs text-amber-400">connect to fund</span>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <Balance
          label="SUI"
          value={fmt(suiQ.data?.totalBalance, 9, 3)}
          hint="gas"
          loading={suiQ.isLoading}
        />
        <Balance
          label="dUSDC"
          value={fmt(dusdcQ.data?.totalBalance, 6, 2)}
          hint="Predict quote"
          loading={dusdcQ.isLoading}
          warn={dusdcZero}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={getSui}
          disabled={requesting}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
        >
          {requesting ? "Requesting…" : "Get SUI"}
        </button>
        <a
          href={DUSDC_FAUCET_URL}
          target="_blank"
          rel="noreferrer"
          className={`rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors ${
            dusdcZero
              ? "bg-emerald-600 hover:bg-emerald-500"
              : "bg-emerald-600/70 hover:bg-emerald-500"
          }`}
        >
          Get dUSDC
        </a>
      </div>
    </div>
  );
}

function Balance({
  label,
  value,
  hint,
  loading,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-semibold ${warn ? "text-amber-400" : "text-foreground"}`}>
        {loading ? "…" : value}
      </span>
      {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

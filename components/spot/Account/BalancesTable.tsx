"use client";

/**
 * Balances tab — wallet + trading-account holdings per coin, claimable settled
 * funds, and deposit/withdraw actions. Built on the shadcn DataTable so columns
 * sort; the `hideSmall` flag filters out dust rows.
 */
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { TokenIcon } from "@/components/ui/token-icon";
import { ACCOUNT_COINS, formatAmount, getSpotPool } from "@/lib/deepbook/core";
import { SUI_GAS_RESERVE } from "@/lib/deepbook/domain/constants";
import { useBalanceManager, useDeepBookAddress } from "@/lib/deepbook/hooks/account";
import {
  useManagerBalances,
  useOpenOrders,
  useWalletBalances,
} from "@/lib/deepbook/hooks/reads";
import { useSpotActions } from "@/lib/deepbook/hooks/useSpotActions";
import { EmptyState } from "./parts";
import NeedsAccount from "./NeedsAccount";
import TransferForm from "./TransferForm";
import { DataTable, SortHeader } from "./DataTable";

const SMALL = 1e-4; // dust threshold for "hide small balances"

type Action = { kind: "deposit" | "withdraw"; coin: string };
type Row = { coin: string; wallet: number; manager: number; settled: number; total: number };

export default function BalancesTable({
  poolKey,
  hideSmall = false,
}: {
  poolKey: string;
  hideSmall?: boolean;
}) {
  const pool = getSpotPool(poolKey);
  const address = useDeepBookAddress();
  const { managerId } = useBalanceManager();
  const { data: walletBal } = useWalletBalances();
  const { data: managerBal } = useManagerBalances();
  const { data: openOrders } = useOpenOrders(poolKey);
  const { deposit, withdraw, claimSettled, isPending, status } = useSpotActions(poolKey);

  const settled = openOrders?.settled;
  const settledFor = (coin: string) =>
    !settled
      ? 0
      : coin === pool.base
        ? settled.base
        : coin === pool.quote
          ? settled.quote
          : coin === "DEEP"
            ? settled.deep
            : 0;

  const [action, setAction] = useState<Action | null>(null);

  const maxFor = (kind: "deposit" | "withdraw", coin: string) => {
    if (kind === "withdraw") return managerBal?.[coin] ?? 0;
    const w = walletBal?.[coin] ?? 0;
    return coin === "SUI" ? Math.max(0, w - SUI_GAS_RESERVE) : w;
  };

  const runTransfer = async (amountNum: number) => {
    if (!action || amountNum <= 0) return;
    const max = maxFor(action.kind, action.coin);
    if (action.kind === "deposit") await deposit(action.coin, amountNum);
    else await withdraw(action.coin, amountNum >= max - 1e-9 ? "all" : amountNum);
    setAction(null);
  };

  const rows = useMemo<Row[]>(() => {
    const min = hideSmall ? SMALL : 1e-9;
    return ACCOUNT_COINS.map(coin => {
      const wallet = walletBal?.[coin] ?? 0;
      const manager = managerBal?.[coin] ?? 0;
      const s = settledFor(coin);
      return { coin, wallet, manager, settled: s, total: wallet + manager + s };
    }).filter(r => r.total > min);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletBal, managerBal, settled, hideSmall, pool.base, pool.quote]);

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "coin",
        header: ({ column }) => <SortHeader column={column} title="Coin" />,
        cell: ({ row }) => (
          <span className="flex items-center gap-2 font-medium text-white">
            <TokenIcon symbol={row.original.coin} size={18} isSpot />
            {row.original.coin}
          </span>
        ),
      },
      {
        accessorKey: "wallet",
        header: ({ column }) => (
          <SortHeader column={column} title="Wallet" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-nav-inactive tabular-nums">
            {formatAmount(row.original.wallet, 6)}
          </div>
        ),
      },
      {
        accessorKey: "manager",
        header: ({ column }) => (
          <SortHeader column={column} title="Trading Account" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-white tabular-nums">
            <div>{formatAmount(row.original.manager, 6)}</div>
            {row.original.settled > 1e-9 && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => claimSettled()}
                className="mt-0.5 text-[10px] text-primary hover:underline disabled:opacity-50"
                title="Filled-but-unclaimed funds from a trade. Claim to move them into your trading account."
              >
                +{formatAmount(row.original.settled, 6)} settled · Claim
              </button>
            )}
          </div>
        ),
      },
      {
        accessorKey: "total",
        header: ({ column }) => (
          <SortHeader column={column} title="Total" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-white tabular-nums">
            {formatAmount(row.original.total, 6)}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="text-right whitespace-nowrap">
            <button
              className="text-primary hover:opacity-80 mr-3"
              onClick={() => setAction({ kind: "deposit", coin: row.original.coin })}
            >
              Deposit
            </button>
            <button
              className="text-nav-inactive hover:text-[#FF4D4F]"
              onClick={() => setAction({ kind: "withdraw", coin: row.original.coin })}
            >
              Withdraw
            </button>
          </div>
        ),
      },
    ],
    [isPending, claimSettled]
  );

  if (!address || !managerId)
    return <NeedsAccount label="Connect and create a trading account to manage balances." />;

  return (
    <div>
      <DataTable
        columns={columns}
        data={rows}
        empty={
          <EmptyState>
            No balances yet — get testnet SUI from{" "}
            <a
              href="https://faucet.sui.io"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              faucet.sui.io
            </a>
            , then sell SUI for DBUSDC.
          </EmptyState>
        }
      />

      {action && (
        <TransferForm
          key={`${action.kind}-${action.coin}`}
          kind={action.kind}
          coin={action.coin}
          max={maxFor(action.kind, action.coin)}
          isPending={isPending}
          status={status}
          onSubmit={runTransfer}
          onCancel={() => setAction(null)}
        />
      )}
    </div>
  );
}

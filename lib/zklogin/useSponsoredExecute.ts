"use client";

/**
 * Drop-in replacement for dapp-kit's `useSignAndExecuteTransaction`.
 *
 * When the connected account is the zkLogin one, it sponsors + zkLogin-signs the
 * transaction (no wallet popup, sponsor pays gas). Otherwise it delegates to
 * dapp-kit so a normal browser wallet (Slush) keeps working unchanged.
 *
 * The shape matches dapp-kit's hook, so write hooks only swap the import.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useSignAndExecuteTransaction as useDappKitSignAndExecute, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getSession } from "./session";
import { sponsorAndExecute } from "./sponsoredTx";

interface ExecuteArgs {
  transaction: Transaction | string;
  account?: { address: string };
  chain?: string;
}

interface ExecuteResult {
  digest: string;
  effects?: string;
  bytes?: string;
  signature?: string;
}

export function useSignAndExecuteTransaction(): UseMutationResult<
  ExecuteResult,
  Error,
  ExecuteArgs
> {
  const client = useSuiClient() as unknown as SuiJsonRpcClient;
  const account = useActiveAccount();
  const fallback = useDappKitSignAndExecute();

  return useMutation<ExecuteResult, Error, ExecuteArgs>({
    mutationFn: async (args) => {
      const session = getSession();
      const sender = args.account?.address ?? account?.address;
      // sponsor only when the connected account is the zkLogin identity
      if (session && sender && session.address === sender) {
        const tx =
          typeof args.transaction === "string"
            ? Transaction.from(args.transaction)
            : args.transaction;
        return sponsorAndExecute({ transaction: tx, sender, session, client });
      }
      return fallback.mutateAsync(
        args as Parameters<typeof fallback.mutateAsync>[0],
      ) as Promise<ExecuteResult>;
    },
  });
}

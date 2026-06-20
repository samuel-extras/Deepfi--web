"use client";

/**
 * Wallet identity + BalanceManager lifecycle for DeepBook trading.
 *
 * Wallet signing via dapp-kit; the manager is discovered from the on-chain
 * registry (falling back to a local cache) and created via a single PTB. The
 * SDK client is bound to wallet + manager so reads/writes share one config.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useCallback, useMemo, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { useSignAndExecuteTransaction } from "@/lib/zklogin/useSponsoredExecute";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DB_NETWORK,
  buildCreateManagerTx,
  makeDeepBookClient,
} from "@/lib/deepbook/core";

const managerStorageKey = (address: string) =>
  `deepfi.deepbook.manager.${DB_NETWORK}.${address}`;

/** Connected wallet address (no dev fallback — trading needs a real signer). */
export function useDeepBookAddress(): string | undefined {
  return useActiveAccount()?.address;
}

/** The user's BalanceManager: discovery (registry + local cache) + creation. */
export function useBalanceManager() {
  const suiClient = useSuiClient();
  const address = useDeepBookAddress();
  const queryClient = useQueryClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [isCreating, setIsCreating] = useState(false);

  const query = useQuery({
    queryKey: ["deepbook", "manager", DB_NETWORK, address],
    enabled: !!address,
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      if (!address) return null;
      const db = makeDeepBookClient(suiClient, address);
      const cached = localStorage.getItem(managerStorageKey(address));
      let ids: string[] = [];
      try {
        ids = await db.getBalanceManagerIds(address);
      } catch {
        // registry read failing shouldn't lock the user out of a cached manager
      }
      if (cached && ids.includes(cached)) return cached;
      if (ids.length > 0) return ids[0];
      // Managers created before we registered them are only known locally.
      return cached || null;
    },
  });

  const create = useCallback(async (): Promise<string | undefined> => {
    if (!address) {
      toast.error("Connect your Sui wallet first");
      return;
    }
    setIsCreating(true);
    try {
      const res = await signAndExecute({ transaction: buildCreateManagerTx() });
      await suiClient.waitForTransaction({ digest: res.digest });
      const full = await suiClient.getTransactionBlock({
        digest: res.digest,
        options: { showObjectChanges: true },
      });
      const created = full.objectChanges?.find(
        c =>
          c.type === "created" &&
          "objectType" in c &&
          c.objectType.includes("::balance_manager::BalanceManager")
      );
      const id = created && "objectId" in created ? created.objectId : null;
      if (!id) throw new Error("BalanceManager creation returned no object id");
      localStorage.setItem(managerStorageKey(address), id);
      queryClient.setQueryData(["deepbook", "manager", DB_NETWORK, address], id);
      toast.success("Trading account created");
      return id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Couldn't create trading account: ${msg.slice(0, 160)}`);
    } finally {
      setIsCreating(false);
    }
  }, [address, signAndExecute, suiClient, queryClient]);

  return {
    managerId: query.data ?? null,
    isLoading: query.isLoading,
    create,
    isCreating,
  };
}

/** DeepBook SDK client bound to wallet + manager (null until connected). */
export function useDeepBookClient() {
  const suiClient = useSuiClient();
  const address = useDeepBookAddress();
  const { managerId } = useBalanceManager();

  const client = useMemo(
    () =>
      address ? makeDeepBookClient(suiClient, address, managerId) : null,
    [suiClient, address, managerId]
  );
  return { client, address, managerId };
}

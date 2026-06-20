"use client";

/**
 * The active on-chain identity, zkLogin-aware. Returns the zkLogin (Google)
 * session address when signed in, otherwise a connected dapp-kit wallet (Slush).
 *
 * Drop-in replacement for dapp-kit's `useCurrentAccount()` — every call site only
 * reads `.address` (and occasionally `.chains`). We use this instead of
 * `useCurrentAccount` so balances, the sponsored-tx sender, and "connect" gating
 * all see the zkLogin address (zkLogin is NOT a dapp-kit wallet here).
 */
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useZkLoginStore } from "@/stores/useZkLoginStore";
import { SUI_NETWORK } from "@/lib/sui/network";

export interface ActiveAccount {
  address: string;
  chains: readonly string[];
}

export function useActiveAccount(): ActiveAccount | null {
  const dappAccount = useCurrentAccount();
  const zkAddress = useZkLoginStore((s) => s.session?.address);

  if (zkAddress) return { address: zkAddress, chains: [`sui:${SUI_NETWORK}`] };
  if (dappAccount)
    return { address: dappAccount.address, chains: dappAccount.chains };
  return null;
}

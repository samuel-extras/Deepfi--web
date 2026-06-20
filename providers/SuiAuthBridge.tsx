"use client";

/**
 * Bridges identity into the app's auth store. Prefers the zkLogin (Google)
 * session when present; otherwise a connected browser wallet (Slush, via
 * dapp-kit); otherwise falls back to the dev address so screens aren't blank.
 */
import { useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useAuthStore } from "@/stores/useAuthStore";
import { useZkLoginStore } from "@/stores/useZkLoginStore";
import { DEV_ADDRESS } from "@/lib/sui/network";

export function SuiAuthBridge() {
  const account = useCurrentAccount();
  const zkAddress = useZkLoginStore((s) => s.session?.address);

  useEffect(() => {
    const address = zkAddress ?? account?.address;
    if (address) {
      // Real identity (zkLogin or connected wallet) → authenticated.
      useAuthStore.getState().loginWithWallet("embedded", address);
    } else {
      // Not signed in → navbar shows "Connect". Keep the dev address ONLY as a
      // data-read fallback so screens aren't blank; isAuthenticated stays false.
      useAuthStore.setState({ isAuthenticated: false, authType: null });
      useAuthStore.getState().setUserInfo({ walletAddress: DEV_ADDRESS });
    }
  }, [zkAddress, account?.address]);

  return null;
}

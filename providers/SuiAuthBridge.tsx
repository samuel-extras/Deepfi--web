"use client";

/**
 * Bridges the real connected Sui wallet (Slush, via dapp-kit) into the app's
 * auth store. When a wallet is connected, the app uses that real address;
 * otherwise it falls back to the dev address so the app stays usable in
 * development (and the legacy DEXV2 components that assume a connected wallet
 * keep working). Replaces the mock-only identity with a real one when present.
 */
import { useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useAuthStore } from "@/stores/useAuthStore";
import { DEV_ADDRESS } from "@/lib/sui/network";

export function SuiAuthBridge() {
  const account = useCurrentAccount();

  useEffect(() => {
    if (account?.address) {
      // Real connected Slush wallet → authenticated with the real address.
      useAuthStore.getState().loginWithWallet("embedded", account.address);
    } else {
      // Not connected → navbar shows "Connect". Keep the dev address ONLY as a
      // data-read fallback so screens aren't blank; isAuthenticated stays false.
      useAuthStore.setState({ isAuthenticated: false, authType: null });
      useAuthStore.getState().setUserInfo({ walletAddress: DEV_ADDRESS });
    }
  }, [account?.address]);

  return null;
}

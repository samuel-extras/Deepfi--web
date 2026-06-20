"use client";

/**
 * Sui dapp-kit providers (testnet). Gives components access to a shared
 * SuiClient via `useSuiClient()` / `useSuiClientQuery()` and wallet connection
 * (Slush + others). Must sit inside a react-query provider.
 */
import type { ReactNode } from "react";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import "@mysten/dapp-kit/dist/index.css";
import { SUI_NETWORK, SUI_NETWORKS } from "@/lib/sui/network";
import { SuiAuthBridge } from "./SuiAuthBridge";
import { ZkLoginRegistrar } from "./ZkLoginRegistrar";

export function SuiProvider({ children }: { children: ReactNode }) {
  return (
    <SuiClientProvider networks={SUI_NETWORKS} defaultNetwork={SUI_NETWORK}>
      <WalletProvider autoConnect>
        <ZkLoginRegistrar />
        <SuiAuthBridge />
        {children}
      </WalletProvider>
    </SuiClientProvider>
  );
}

// Shim for `wagmi` — replaces EVM wallet plumbing with an always-connected mock.
// See shims/mock-auth.ts for rationale.
"use client";

import type { ReactNode } from "react";
import {
  MOCK_ADDRESS,
  MOCK_CHAIN_ID,
  mockEip1193Provider,
} from "../mock-auth";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function WagmiProvider({
  children,
}: {
  children: ReactNode;
  /** Accepted for API parity with real wagmi; ignored by the mock. */
  config?: any;
}) {
  return <>{children}</>;
}

export function createConfig(_config?: any): any {
  return { chains: [], connectors: [], _isMock: true };
}

export function http(_url?: string, _config?: any): any {
  return () => ({});
}

const mockConnector = {
  id: "mock",
  name: "Mock Wallet",
  type: "injected" as const,
  uid: "mock",
  getProvider: async () => mockEip1193Provider,
  getAccounts: async () => [MOCK_ADDRESS],
  getChainId: async () => MOCK_CHAIN_ID,
};

export function useAccount(): any {
  return {
    address: MOCK_ADDRESS,
    addresses: [MOCK_ADDRESS],
    chainId: MOCK_CHAIN_ID,
    chain: undefined,
    connector: mockConnector,
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
    isReconnecting: false,
    status: "connected" as const,
  };
}

export function useDisconnect(): any {
  return {
    disconnect: () => {},
    disconnectAsync: async () => {},
    connectors: [],
    isPending: false,
  };
}

export function useConnect(): any {
  return {
    connect: () => {},
    connectAsync: async () => ({ accounts: [MOCK_ADDRESS], chainId: MOCK_CHAIN_ID }),
    connectors: [mockConnector],
    isPending: false,
    error: null,
  };
}

export function useSignMessage(): any {
  const sig = ("0x" + "0".repeat(130)) as `0x${string}`;
  return {
    signMessage: () => {},
    signMessageAsync: async () => sig,
    isPending: false,
    data: undefined,
  };
}

export function useChainId(): number {
  return MOCK_CHAIN_ID;
}

export function useSwitchChain(): any {
  return {
    switchChain: () => {},
    switchChainAsync: async () => {},
    chains: [],
    isPending: false,
  };
}

export function useWalletClient(): any {
  return { data: undefined, isLoading: false };
}

export function usePublicClient(): any {
  return undefined;
}

export function useConfig(): any {
  return createConfig();
}

export type Config = any;
export type Connector = any;

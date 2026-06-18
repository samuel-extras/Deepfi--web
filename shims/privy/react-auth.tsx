// Shim for `@privy-io/react-auth` — replaces Privy auth with an always-connected
// mock user so the DEXV2 UI renders without real login. See shims/mock-auth.ts.
"use client";

import type { ReactNode } from "react";
import { MOCK_ADDRESS, mockEip1193Provider } from "../mock-auth";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---- Types (loose; real Privy types are not installed) ----
export type User = {
  id: string;
  email?: { address: string };
  wallet?: { address: string; connectorType?: string };
  linkedAccounts: Array<Record<string, unknown>>;
};

/** Callbacks accepted by the email/SIWE login hooks (mirrors real Privy). */
type AuthCallbacks = {
  onComplete?: (args: { user: User; isNewUser?: boolean }) => void | Promise<void>;
  onError?: (error: unknown) => void;
};

/** Callbacks accepted by the account-linking hook. */
type LinkAccountCallbacks = {
  onSuccess?: (args: { linkedAccount: Record<string, unknown> }) => void;
  onError?: (error: unknown) => void;
};

export type ConnectedWallet = {
  address: string;
  connectorType: string;
  walletClientType: string;
  getEthereumProvider: () => Promise<typeof mockEip1193Provider>;
  getEthersProvider?: () => Promise<typeof mockEip1193Provider>;
};

const MOCK_USER: User = {
  id: "mock-user",
  wallet: { address: MOCK_ADDRESS, connectorType: "embedded" },
  linkedAccounts: [
    { type: "wallet", address: MOCK_ADDRESS, connectorType: "embedded" },
  ],
};

const MOCK_WALLET: ConnectedWallet = {
  address: MOCK_ADDRESS,
  connectorType: "embedded",
  walletClientType: "privy",
  getEthereumProvider: async () => mockEip1193Provider,
  getEthersProvider: async () => mockEip1193Provider,
};

export function PrivyProvider({ children }: { children: ReactNode; [k: string]: any }) {
  return <>{children}</>;
}

export function usePrivy(): any {
  return {
    ready: true,
    authenticated: true,
    user: MOCK_USER,
    login: () => {},
    logout: async () => {},
    connectWallet: () => {},
    createWallet: async () => MOCK_WALLET,
    exportWallet: async () => {},
    linkWallet: () => {},
    linkEmail: () => {},
    sendTransaction: async () => ({ hash: "0x" }),
    signMessage: async () => "0x",
  };
}

export function useWallets(): any {
  return { ready: true, wallets: [MOCK_WALLET] };
}

export function useLogin(): any {
  return { login: () => {} };
}

export function useLogout(): any {
  return { logout: async () => {} };
}

export function useLoginWithEmail(_opts?: AuthCallbacks): any {
  return {
    sendCode: async () => ({ success: true }),
    loginWithCode: async () => ({ user: MOCK_USER }),
    state: { status: "initial" },
  };
}

export function useLoginWithSiwe(_opts?: AuthCallbacks): any {
  return {
    generateSiweMessage: async () => "",
    loginWithSiwe: async () => ({ user: MOCK_USER }),
    state: { status: "initial" },
  };
}

export function useLinkAccount(_opts?: LinkAccountCallbacks): any {
  return {
    linkWallet: () => {},
    linkEmail: () => {},
    linkGoogle: () => {},
    linkTwitter: () => {},
  };
}

export function useCreateWallet(): any {
  return { createWallet: async () => MOCK_WALLET };
}

export function useConnectWallet(): any {
  return { connectWallet: () => {} };
}

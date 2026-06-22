"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthType = "email" | "wallet" | null;
export type WalletType =
  | "metamask"
  | "walletconnect"
  | "okx"
  | "coinbase"
  | "embedded"
  | null;

export type ConnectorType =
  | "injected"
  | "walletconnect"
  | "coinbase"
  | "okx"
  | "embedded"
  | null;

interface AuthState {
  authType: AuthType;
  isAuthenticated: boolean;

  userInfo: {
    email?: string;
    walletAddress?: string;
    walletType?: WalletType;
    connectorType?: ConnectorType;
  };

  jwtToken: string | null;

  isConnecting: boolean;
  connectionError: string | null;
}

interface AuthActions {
  setAuthType: (type: AuthType) => void;
  setUserInfo: (info: Partial<AuthState["userInfo"]>) => void;
  setWalletType: (type: WalletType) => void;
  setConnectorType: (type: ConnectorType) => void;

  setConnecting: (connecting: boolean) => void;
  setConnectionError: (error: string | null) => void;

  setEmbeddedWallet: (address: string) => void;
  loginWithEmail: (email: string) => void;
  loginWithWallet: (walletType: WalletType, walletAddress: string) => void;
  setJwtToken: (token: string | null) => void;
  clearJwtToken: () => void;
  logout: () => void;
  reset: () => void;
}

const initialState: AuthState = {
  authType: null,
  isAuthenticated: false,
  userInfo: {},
  jwtToken: null,
  isConnecting: false,
  connectionError: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAuthType: type => set({ authType: type }),

      setUserInfo: info => {
        const currentUserInfo = get().userInfo;
        set({ userInfo: { ...currentUserInfo, ...info } });
      },

      setWalletType: type =>
        set({ userInfo: { ...get().userInfo, walletType: type } }),

      setConnectorType: type =>
        set({ userInfo: { ...get().userInfo, connectorType: type } }),

      setEmbeddedWallet: (address: string) => {
        set({
          userInfo: {
            ...get().userInfo,
            walletAddress: address,
            walletType: "embedded",
            connectorType: "embedded",
          },
        });
      },

      setConnecting: connecting => set({ isConnecting: connecting }),

      setConnectionError: error => set({ connectionError: error }),

      loginWithEmail: email => {
        set({
          authType: "email",
          isAuthenticated: true,
          userInfo: { email },
          isConnecting: false,
          connectionError: null,
        });
      },

      loginWithWallet: (walletType, walletAddress) => {
        set({
          authType: "wallet",
          isAuthenticated: true,
          userInfo: { walletAddress, walletType },
          isConnecting: false,
          connectionError: null,
        });
      },

      setJwtToken: token => set({ jwtToken: token }),

      clearJwtToken: () => set({ jwtToken: null }),

      logout: () => {
        set({
          ...initialState,
          jwtToken: null,
        });
      },

      reset: () => set(initialState),
    }),
    {
      name: "dex:auth",
      partialize: state => ({
        authType: state.authType,
        isAuthenticated: state.isAuthenticated,
        userInfo: state.userInfo,
        jwtToken: state.jwtToken,
      }),
    }
  )
);

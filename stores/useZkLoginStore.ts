"use client";

/**
 * Reactive mirror of the zkLogin session (raw Sui zkLogin, no Enoki).
 * The single source of truth for the zkLogin identity — `SuiAuthBridge` reads
 * `session.address` from here, the connect dialog calls `login`, and the OAuth
 * callback calls `complete`.
 */
import { create } from "zustand";
import {
  beginLogin,
  completeLogin,
  clearSession,
  getSession,
  type ZkSession,
} from "@/lib/zklogin/session";
import type { ZkProvider } from "@/lib/zklogin/config";

type Status = "idle" | "authenticating" | "error";

interface ZkLoginState {
  session: ZkSession | null;
  status: Status;
  error: string | null;
  /** Start the OAuth flow (redirects away on success). */
  login: (provider: ZkProvider) => Promise<void>;
  /** Finish on the callback: id_token → session. */
  complete: (idToken: string) => Promise<ZkSession>;
  /** Re-hydrate any session persisted in sessionStorage. */
  restore: () => void;
  logout: () => void;
}

export const useZkLoginStore = create<ZkLoginState>((set) => ({
  session: null,
  status: "idle",
  error: null,

  login: async (provider) => {
    set({ status: "authenticating", error: null });
    try {
      await beginLogin(provider); // redirects
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  },

  complete: async (idToken) => {
    set({ status: "authenticating", error: null });
    try {
      const session = await completeLogin(idToken);
      set({ session, status: "idle", error: null });
      return session;
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  },

  restore: () => set({ session: getSession() }),

  logout: () => {
    clearSession();
    set({ session: null, status: "idle", error: null });
  },
}));

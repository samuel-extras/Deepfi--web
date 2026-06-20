"use client";

/**
 * Re-hydrates any persisted zkLogin session on load so the user stays signed in
 * across reloads (until the ephemeral key's maxEpoch). Mounted in SuiProvider.
 */
import { useEffect } from "react";
import { useZkLoginStore } from "@/stores/useZkLoginStore";

export function ZkLoginRegistrar() {
  useEffect(() => {
    useZkLoginStore.getState().restore();
  }, []);
  return null;
}

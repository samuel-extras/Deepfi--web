/**
 * Sui network configuration for DeepFi. Everything runs on **testnet**.
 */
// @mysten/sui v2 split the classic JSON-RPC client into `@mysten/sui/jsonRpc`
// (`getJsonRpcFullnodeUrl` replaces the old `getFullnodeUrl`).
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

export const SUI_NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ??
  "testnet") as "testnet" | "mainnet" | "devnet" | "localnet";

export const SUI_FULLNODE_URL =
  process.env.NEXT_PUBLIC_SUI_RPC_URL ?? getJsonRpcFullnodeUrl(SUI_NETWORK);

/** dapp-kit network config (SuiClientProvider `networks` prop). */
export const SUI_NETWORKS = {
  testnet: { url: getJsonRpcFullnodeUrl("testnet"), network: "testnet" },
  mainnet: { url: getJsonRpcFullnodeUrl("mainnet"), network: "mainnet" },
  devnet: { url: getJsonRpcFullnodeUrl("devnet"), network: "devnet" },
  localnet: { url: getJsonRpcFullnodeUrl("localnet"), network: "localnet" },
} as const;

/**
 * The dev/owner address (local Sui keystore: alias `flamboyant-phenacite`).
 * Used as the "connected" identity until real Enoki zkLogin lands (Phase 1).
 */
export const DEV_ADDRESS =
  "0xd3e835d573c126bb7f5266f3d5390cdf0eba7bf05984316cfb0675f4be362b91";

/**
 * Shared read-only SuiClient (testnet). Use this for plain RPC reads outside of
 * React. Inside React components prefer dapp-kit's `useSuiClient()` /
 * `useSuiClientQuery()` so calls share the provider's client + react-query cache.
 */
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { SUI_FULLNODE_URL, SUI_NETWORK } from "./network";

let _client: SuiJsonRpcClient | null = null;

export function getSuiClient(): SuiJsonRpcClient {
  if (!_client) {
    _client = new SuiJsonRpcClient({ url: SUI_FULLNODE_URL, network: SUI_NETWORK });
  }
  return _client;
}

export const suiClient = getSuiClient();

/**
 * Server-side Enoki sponsorship (gasless transactions).
 *
 * Uses the SECRET ENOKI_PRIVATE_KEY — must stay server-only (imported only from
 * app/api/sponsor/* route handlers, never client code). The gas pool pays gas
 * so users transact without holding SUI.
 *
 * Flow: client builds a tx → /api/sponsor/create (sponsor it) → client signs the
 * returned bytes with their wallet → /api/sponsor/execute (submit).
 */
import { EnokiClient } from "@mysten/enoki";
import { SUI_NETWORK } from "./network";

let _client: EnokiClient | null = null;

export function getEnokiServerClient(): EnokiClient {
  const apiKey = process.env.ENOKI_PRIVATE_KEY;
  if (!apiKey) throw new Error("ENOKI_PRIVATE_KEY is not set");
  if (!_client) _client = new EnokiClient({ apiKey });
  return _client;
}

const network = (SUI_NETWORK === "mainnet" ? "mainnet" : "testnet") as
  | "mainnet"
  | "testnet";

export function sponsorTransaction(input: {
  transactionKindBytes: string; // base64 tx kind (onlyTransactionKind)
  sender: string;
  allowedMoveCallTargets?: string[];
  allowedAddresses?: string[];
}) {
  return getEnokiServerClient().createSponsoredTransaction({
    network,
    transactionKindBytes: input.transactionKindBytes,
    sender: input.sender,
    allowedMoveCallTargets: input.allowedMoveCallTargets,
    allowedAddresses: input.allowedAddresses,
  });
}

export function executeSponsoredTransaction(input: {
  digest: string;
  signature: string;
}) {
  return getEnokiServerClient().executeSponsoredTransaction(input);
}

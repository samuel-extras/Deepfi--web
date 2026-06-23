"use client";

/**
 * The one place the sponsored-write happens, shared by the execute hook:
 *   build onlyTransactionKind → /api/sponsor/create → zkLogin-sign → execute.
 * No wallet popup; the sponsor pays gas.
 */
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { zkSignTransaction, type ZkSession } from "./session";

export interface SponsoredExecuteResult {
  digest: string;
  effects?: string;
  bytes: string;
  signature: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: { ok?: boolean; error?: string } & Record<string, unknown>;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `${url} returned non-JSON (HTTP ${r.status}): ${text.slice(0, 100)}`,
    );
  }
  if (!r.ok || json?.ok === false) {
    throw new Error(json?.error ?? `${url} failed (HTTP ${r.status})`);
  }
  return json as T;
}

export async function sponsorAndExecute(opts: {
  transaction: Transaction;
  sender: string;
  session: ZkSession;
  client: SuiJsonRpcClient;
}): Promise<SponsoredExecuteResult> {
  const { transaction, sender, session, client } = opts;
  transaction.setSenderIfNotSet(sender);

  const kindBytes = await transaction.build({
    client,
    onlyTransactionKind: true,
  });
  const { bytes, sponsorSignature } = await postJson<{
    bytes: string;
    sponsorSignature: string;
  }>("/api/sponsor/create", {
    transactionKindBytes: toBase64(kindBytes),
    sender,
  });

  const userSignature = await zkSignTransaction(session, fromBase64(bytes));
  const res = await client.executeTransactionBlock({
    transactionBlock: bytes,
    signature: [userSignature, sponsorSignature],
    options: { showRawEffects: true, showEffects: true },
  });

  // A Move abort still returns a digest with status "failure" — surface it so
  // callers don't report a false success on a reverted transaction.
  const status = res.effects?.status;
  if (status && status.status !== "success") {
    throw new Error(
      status.error
        ? `Transaction reverted on-chain: ${status.error}`
        : "Transaction reverted on-chain",
    );
  }

  return {
    digest: res.digest,
    effects: res.rawEffects
      ? toBase64(new Uint8Array(res.rawEffects))
      : undefined,
    bytes,
    signature: userSignature,
  };
}

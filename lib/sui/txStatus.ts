/**
 * Wait for a transaction AND assert it actually succeeded on-chain.
 *
 * `client.waitForTransaction` only waits for the digest to be indexed — it
 * resolves even for a reverted (Move-abort) transaction, which still gets a
 * digest. Callers that toast "success" off a bare digest therefore report false
 * positives (no balance change, no position). Use this everywhere a write must
 * be confirmed.
 */
/** Minimal structural shape — accepts both the dapp-kit and JSON-RPC clients. */
interface WaitCapableClient {
  waitForTransaction(input: {
    digest: string;
    options?: { showEffects?: boolean };
  }): Promise<{
    effects?: { status?: { status?: string; error?: string | null } } | null;
  }>;
}

export async function waitForTxSuccess(
  client: WaitCapableClient,
  digest: string,
) {
  const tx = await client.waitForTransaction({
    digest,
    options: { showEffects: true },
  });
  const status = tx.effects?.status;
  if (status && status.status !== "success") {
    throw new Error(
      status.error
        ? `Transaction reverted on-chain: ${status.error}`
        : "Transaction reverted on-chain",
    );
  }
  return tx;
}

/**
 * Self-hosted gas sponsorship (no Enoki). A funded testnet keypair pays gas so
 * users transact without holding SUI or approving a wallet popup.
 *
 * SERVER ONLY — reads SPONSOR_PRIVATE_KEY. Import only from app/api/sponsor/*.
 *
 * Flow: client builds `onlyTransactionKind` bytes → createSponsored() sets the
 * sender + sponsor gas and signs → client signs the same bytes with its zkLogin
 * signature → execute with [userSignature, sponsorSignature].
 */
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { fromBase64, toBase64, normalizeSuiAddress } from "@mysten/sui/utils";
import { DEEPBOOK, MARGIN, PACKAGES, PYTH } from "@/lib/deepbook";
import { getSuiClient } from "./client";

const SUI_COIN = "0x2::sui::SUI";

let _sponsor: Ed25519Keypair | null = null;
function sponsorKeypair(): Ed25519Keypair {
  if (_sponsor) return _sponsor;
  const pk = process.env.SPONSOR_PRIVATE_KEY;
  if (!pk) throw new Error("SPONSOR_PRIVATE_KEY is not set");
  const { secretKey } = decodeSuiPrivateKey(pk.trim());
  _sponsor = Ed25519Keypair.fromSecretKey(secretKey);
  return _sponsor;
}

export function sponsorAddress(): string {
  return sponsorKeypair().toSuiAddress();
}

export function isSponsorConfigured(): boolean {
  return Boolean(process.env.SPONSOR_PRIVATE_KEY);
}

/** Packages the sponsor will pay gas for — the app's own protocols + framework. */
const ALLOWED_PACKAGES = new Set(
  [
    PACKAGES.predict,
    PACKAGES.dusdc,
    DEEPBOOK.pkg,
    MARGIN.pkg,
    PYTH.pkg,
    PYTH.wormholePkg,
    "0x1",
    "0x2",
    "0x3",
  ]
    .filter(Boolean)
    .map((a) => normalizeSuiAddress(a)),
);

const MAX_BUDGET = BigInt(process.env.SPONSOR_MAX_BUDGET_MIST ?? "500000000");

/** Reject txs that touch packages we don't sponsor, so the gas pool can't be drained. */
function assertAllowed(tx: Transaction): void {
  if (process.env.SPONSOR_ALLOW_ALL === "true") return;
  for (const cmd of tx.getData().commands) {
    if (cmd.$kind === "MoveCall" && cmd.MoveCall) {
      const pkg = normalizeSuiAddress(cmd.MoveCall.package);
      if (!ALLOWED_PACKAGES.has(pkg)) {
        throw new Error(
          `Sponsor declines: call to non-allowlisted package ${pkg}`,
        );
      }
    }
  }
}

export interface SponsoredResult {
  /** Base64 full transaction bytes (sender + sponsor gas baked in). */
  bytes: string;
  /** Sponsor's signature over those bytes. */
  sponsorSignature: string;
  /** Sponsor address that paid — for display / verification. */
  sponsor: string;
}

export async function createSponsored(input: {
  /** base64, built with `onlyTransactionKind: true`. */
  transactionKindBytes: string;
  sender: string;
}): Promise<SponsoredResult> {
  const c = getSuiClient();
  const tx = Transaction.fromKind(fromBase64(input.transactionKindBytes));
  assertAllowed(tx);

  const sponsor = sponsorAddress();
  tx.setSender(input.sender);
  tx.setGasOwner(sponsor);
  tx.setGasBudget(MAX_BUDGET); // hard cap; sponsor is only charged actual gas used

  const coins = await c.getCoins({
    owner: sponsor,
    coinType: SUI_COIN,
    limit: 50,
  });
  if (!coins.data.length) throw new Error("Sponsor has no SUI to pay gas");
  tx.setGasPayment(
    coins.data.map((coin) => ({
      objectId: coin.coinObjectId,
      version: coin.version,
      digest: coin.digest,
    })),
  );

  const bytes = await tx.build({ client: c });
  const { signature } = await sponsorKeypair().signTransaction(bytes);
  return { bytes: toBase64(bytes), sponsorSignature: signature, sponsor };
}

/** Optional server-side submit (the client normally executes directly). */
export async function executeSponsored(input: {
  bytes: string;
  signatures: string[];
}): Promise<{ digest: string }> {
  const c = getSuiClient();
  const res = await c.executeTransactionBlock({
    transactionBlock: input.bytes,
    signature: input.signatures,
    options: { showEffects: true },
  });
  await c.waitForTransaction({ digest: res.digest });
  return { digest: res.digest };
}

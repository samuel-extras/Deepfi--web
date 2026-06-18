/**
 * Demo-mode bot wallets — keep the live feed populated for demos/judging.
 * Server-only: imports private keys from env; only ever imported by the
 * /api/demo route (never shipped to the client bundle).
 *
 * Each bot is a pre-funded testnet keypair (SUI for gas + dUSDC for trading)
 * supplied via the DEMO_BOT_KEYS env var. On each "tick" every bot places one
 * small, real DeepBook Predict binary trade on a live oracle, using the SAME
 * PTB builders as the user-facing flow — so the trades show up in the real
 * indexer feed exactly like organic ones.
 *
 * dUSDC cannot be auto-faucted (it's behind a Tally form), so bots that run dry
 * are skipped with a clear message rather than failing the whole tick.
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import {
  COIN_TYPES,
  OBJECTS,
  TARGETS,
  fromPriceU64,
  toDusdcU64,
  toStrikeU64,
} from "@/lib/deepbook";
import { getSuiClient } from "@/lib/sui/client";
import { buildCreateManagerTx, addDepositMintBinary } from "@/lib/ptb/predict";
import { indexer, activeOracles, type OracleRow } from "@/lib/indexer";

const DUSDC = COIN_TYPES.dusdc;
const Q0 = 1_000_000; // probe quantity for linear cost sizing

/** Default dUSDC spend per bot trade. */
const DEFAULT_TRADE_DUSDC = Number(process.env.DEMO_BOT_TRADE_DUSDC ?? "1");

export interface BotTickResult {
  address: string;
  ok: boolean;
  action?: string;
  digest?: string;
  skipped?: string;
  error?: string;
}

export interface BotStatus {
  address: string;
  suiBalance: number; // SUI
  dusdcBalance: number; // dUSDC
  hasManager: boolean;
}

const getClient = () => getSuiClient();

/** Cache resolved manager ids per bot address to avoid duplicate creation when
 *  the indexer lags between ticks (same process lifetime). */
const managerCache = new Map<string, string>();

/** Parse DEMO_BOT_KEYS (comma-separated suiprivkey… bech32 secret keys). */
export function loadBotKeypairs(): Ed25519Keypair[] {
  const raw = process.env.DEMO_BOT_KEYS;
  if (!raw) return [];
  const out: Ed25519Keypair[] = [];
  for (const part of raw.split(",").map(s => s.trim()).filter(Boolean)) {
    try {
      out.push(Ed25519Keypair.fromSecretKey(part));
    } catch {
      // skip malformed key, keep the others
    }
  }
  return out;
}

export function demoBotsEnabled(): boolean {
  return loadBotKeypairs().length > 0;
}

/** Resolve (or lazily create + share) a PredictManager for a bot. */
async function ensureManager(kp: Ed25519Keypair): Promise<string> {
  const c = getClient();
  const owner = kp.toSuiAddress();

  const cached = managerCache.get(owner);
  if (cached) return cached;

  const managers = await indexer.managers().catch(() => []);
  const mine = managers
    .filter(m => m.owner === owner)
    .sort((a, b) => b.checkpoint_timestamp_ms - a.checkpoint_timestamp_ms);
  if (mine[0]?.manager_id) {
    managerCache.set(owner, mine[0].manager_id);
    return mine[0].manager_id;
  }

  const tx = buildCreateManagerTx();
  tx.setSender(owner);
  const res = await c.signAndExecuteTransaction({ signer: kp, transaction: tx });
  await c.waitForTransaction({ digest: res.digest });
  const full = await c.getTransactionBlock({
    digest: res.digest,
    options: { showObjectChanges: true },
  });
  const mgr = full.objectChanges?.find(
    ch =>
      ch.type === "created" &&
      "objectType" in ch &&
      ch.objectType.includes("::predict_manager::PredictManager"),
  );
  if (mgr && "objectId" in mgr) {
    managerCache.set(owner, mgr.objectId);
    return mgr.objectId;
  }
  throw new Error("manager creation returned no id");
}

/** devInspect get_trade_amounts to size contract quantity for a dUSDC spend. */
async function sizeBinary(
  owner: string,
  oracleId: string,
  expiryMs: number,
  strikeUsd: number,
  isUp: boolean,
  amountDusdc: number,
): Promise<string> {
  const c = getClient();
  const tx = new Transaction();
  const key = tx.moveCall({
    target: isUp ? TARGETS.marketKeyUp : TARGETS.marketKeyDown,
    arguments: [
      tx.pure.id(oracleId),
      tx.pure.u64(expiryMs),
      tx.pure.u64(toStrikeU64(strikeUsd)),
    ],
  });
  tx.moveCall({
    target: TARGETS.getTradeAmounts,
    arguments: [
      tx.object(OBJECTS.predict),
      tx.object(oracleId),
      key,
      tx.pure.u64(Q0),
      tx.object(OBJECTS.clock),
    ],
  });
  const res = await c.devInspectTransactionBlock({ sender: owner, transactionBlock: tx });
  const rv = res.results?.at(-1)?.returnValues;
  if (!rv?.length) throw new Error("no live quote");
  const askCost = Number(bcs.U64.parse(Uint8Array.from(rv[0][0])));
  if (askCost <= 0) throw new Error("not mintable");
  const qty = Math.floor((Number(toDusdcU64(amountDusdc)) * Q0) / askCost);
  if (qty <= 0) throw new Error("amount too small");
  return String(qty);
}

/** Round a forward price to the oracle's tick grid, in USD. */
function strikeNearForward(forwardUsd: number, tickUsd: number): number {
  if (!(tickUsd > 0)) return Math.round(forwardUsd);
  return Math.round(forwardUsd / tickUsd) * tickUsd;
}

/** Run one trade for a single bot. Never throws — returns a result record. */
async function tradeOnce(
  kp: Ed25519Keypair,
  oracle: OracleRow,
  sizeDusdc: number,
  seed: number,
): Promise<BotTickResult> {
  const c = getClient();
  const owner = kp.toSuiAddress();
  try {
    // dUSDC balance check
    const { data: coins } = await c.getCoins({ owner, coinType: DUSDC });
    const held = coins.reduce((s, co) => s + Number(co.balance), 0);
    if (held < Number(toDusdcU64(sizeDusdc))) {
      return { address: owner, ok: false, skipped: "no dUSDC — fund this wallet from the faucet" };
    }

    const managerId = await ensureManager(kp);

    // Strike near the live forward, random direction (seeded by index+expiry)
    const price = await indexer
      .oraclePriceLatest(oracle.oracle_id)
      .then(p => (Array.isArray(p) ? p[0] : p))
      .catch(() => null);
    // Live /prices/latest rows carry {spot, forward} — there is no `price` field.
    const fwdRaw = price?.forward ?? price?.spot;
    const forwardUsd = fwdRaw
      ? fromPriceU64(fwdRaw)
      : fromPriceU64(oracle.min_strike) * 1.4;
    const tickUsd = fromPriceU64(oracle.tick_size);
    const strikeUsd = strikeNearForward(forwardUsd, tickUsd);
    const isUp = (seed + oracle.expiry) % 2 === 0;

    const quantity = await sizeBinary(owner, oracle.oracle_id, oracle.expiry, strikeUsd, isUp, sizeDusdc);

    // Build deposit + mint, merging the bot's dUSDC coins
    const tx = new Transaction();
    tx.setSender(owner);
    const [primary, ...rest] = coins;
    const src = tx.object(primary.coinObjectId);
    if (rest.length) tx.mergeCoins(src, rest.map(co => tx.object(co.coinObjectId)));
    const [spend] = tx.splitCoins(src, [tx.pure.u64(toDusdcU64(sizeDusdc))]);
    addDepositMintBinary(tx, {
      managerId,
      depositCoin: spend,
      leg: { oracleId: oracle.oracle_id, expiryMs: oracle.expiry, strikeUsd, isUp, quantity },
    });

    const res = await c.signAndExecuteTransaction({ signer: kp, transaction: tx });
    await c.waitForTransaction({ digest: res.digest });
    return {
      address: owner,
      ok: true,
      action: `${isUp ? "UP" : "DOWN"} @ $${Math.round(strikeUsd).toLocaleString()} · ${sizeDusdc} dUSDC`,
      digest: res.digest,
    };
  } catch (e) {
    return { address: owner, ok: false, error: e instanceof Error ? e.message.slice(0, 160) : String(e) };
  }
}

/**
 * Run one demo tick: each bot places one small binary trade on the soonest
 * live BTC oracle. Bots trade sequentially (shared gas/nonce safety).
 */
export async function runDemoBotTick(sizeDusdc = DEFAULT_TRADE_DUSDC): Promise<BotTickResult[]> {
  const bots = loadBotKeypairs();
  if (bots.length === 0) return [];

  const oracles = activeOracles(await indexer.oracles());
  const oracle = oracles.find(o => (o.underlying_asset ?? "").toUpperCase() === "BTC") ?? oracles[0];
  if (!oracle) {
    return bots.map(kp => ({ address: kp.toSuiAddress(), ok: false, skipped: "no active oracle" }));
  }

  const results: BotTickResult[] = [];
  for (let i = 0; i < bots.length; i++) {
    results.push(await tradeOnce(bots[i], oracle, sizeDusdc, i));
  }
  return results;
}

/** Read-only status for each configured bot (addresses + balances). */
export async function getBotStatuses(): Promise<BotStatus[]> {
  const c = getClient();
  const bots = loadBotKeypairs();
  const managers = await indexer.managers().catch(() => []);
  return Promise.all(
    bots.map(async kp => {
      const address = kp.toSuiAddress();
      const [sui, dusdc] = await Promise.all([
        c.getBalance({ owner: address }).catch(() => ({ totalBalance: "0" })),
        c.getBalance({ owner: address, coinType: DUSDC }).catch(() => ({ totalBalance: "0" })),
      ]);
      return {
        address,
        suiBalance: Number(sui.totalBalance) / 1e9,
        dusdcBalance: Number(dusdc.totalBalance) / 1e6,
        hasManager: managers.some(m => m.owner === address),
      };
    }),
  );
}

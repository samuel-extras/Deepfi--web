/**
 * Cross-venue transfer PTB builders (wallet ⇄ a single venue, coin-correct).
 *
 * On testnet the three venues do NOT share one coin — Predict settles in dUSDC,
 * while DeepBook spot/margin use DBUSDC/SUI — so a "transfer" is always a real
 * deposit or withdraw between ONE venue and the wallet, in that venue's native
 * coin. Spot and Margin moves reuse the DeepBook SDK actions (see
 * useSpotActions / useMarginActions); the Predict legs are plain Move calls and
 * live here.
 *
 * Pure functions over @mysten/sui Transaction — no network calls.
 */
import { Transaction } from "@mysten/sui/transactions";
import { COIN_TYPES, TARGETS, toDusdcU64 } from "@/lib/deepbook";

const DUSDC = COIN_TYPES.dusdc;

/**
 * Wallet → Predict: merge the caller's dUSDC coins, split the exact amount, and
 * deposit it into the PredictManager's internal balance. The manager must
 * already exist (create_manager shares it and returns an id by value, so a
 * fresh manager can't be deposited into in the same PTB).
 */
export function buildPredictDepositTx(params: {
  managerId: string;
  amountDusdc: number;
  dusdcCoinIds: string[];
}): Transaction {
  const { managerId, amountDusdc, dusdcCoinIds } = params;
  if (dusdcCoinIds.length === 0) {
    throw new Error("No dUSDC in wallet — claim from the faucet first");
  }

  const tx = new Transaction();
  const primary = tx.object(dusdcCoinIds[0]);
  if (dusdcCoinIds.length > 1) {
    tx.mergeCoins(
      primary,
      dusdcCoinIds.slice(1).map((id) => tx.object(id)),
    );
  }
  const [deposit] = tx.splitCoins(primary, [tx.pure.u64(toDusdcU64(amountDusdc))]);
  tx.moveCall({
    target: TARGETS.managerDeposit,
    typeArguments: [DUSDC],
    arguments: [tx.object(managerId), deposit],
  });
  return tx;
}

/**
 * Predict → Wallet: withdraw `amountDusdc` from the PredictManager balance back
 * to the owner. The withdraw_cap is held internally by the manager, so only the
 * owner can call it. (Mirror of buildWithdrawFromManagerTx in ./predict.)
 */
export function buildPredictWithdrawTx(params: {
  managerId: string;
  amountDusdc: number;
  recipient: string;
}): Transaction {
  const tx = new Transaction();
  const coin = tx.moveCall({
    target: TARGETS.managerWithdraw,
    typeArguments: [DUSDC],
    arguments: [
      tx.object(params.managerId),
      tx.pure.u64(toDusdcU64(params.amountDusdc)),
    ],
  });
  tx.transferObjects([coin], tx.pure.address(params.recipient));
  return tx;
}

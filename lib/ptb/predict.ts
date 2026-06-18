/**
 * Real DeepBook Predict PTB builders (predict-testnet-4-16).
 * Pure functions over @mysten/sui Transaction — no network calls.
 *
 * On-chain facts that shape these:
 *  - PredictManager is a SHARED object; `create_manager` shares it and returns an
 *    ID *value*, so it can't be used as a &mut handle in the same PTB. Create the
 *    manager in its own tx first, then deposit/mint against it by ID.
 *  - mint / mint_range pull cost from the manager's internal balance, so we must
 *    deposit dUSDC into the manager before minting (composable within one PTB).
 *  - Quote type for all generic calls is dUSDC.
 */

import { Transaction, type TransactionObjectArgument } from "@mysten/sui/transactions";
import {
  COIN_TYPES,
  OBJECTS,
  TARGETS,
  toDusdcU64,
  toStrikeU64,
} from "@/lib/deepbook";

const DUSDC = COIN_TYPES.dusdc;

/** One-shot: create a shared PredictManager for the caller. */
export function buildCreateManagerTx(): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: TARGETS.createManager });
  return tx;
}

/** Supply dUSDC into the PLP vault, returning PLP shares to the sender. */
export function buildSupplyTx(params: {
  amountDusdc: number;
  dusdcCoinId: string;
  sender: string;
}): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.object(params.dusdcCoinId), [
    tx.pure.u64(toDusdcU64(params.amountDusdc)),
  ]);
  const lp = tx.moveCall({
    target: TARGETS.supply,
    typeArguments: [DUSDC],
    arguments: [tx.object(OBJECTS.predict), coin, tx.object(OBJECTS.clock)],
  });
  tx.transferObjects([lp], tx.pure.address(params.sender));
  return tx;
}

/**
 * Add a supply leg to an existing tx: split `amountDusdc` from `source`, supply
 * it to the PLP vault, and transfer the PLP shares to `sender`. Lets a caller
 * compose PLP supply with other legs (e.g. a crash-hedge mint) in one PTB.
 */
export function addSupply(
  tx: Transaction,
  params: {
    amountDusdc: number;
    source: TransactionObjectArgument;
    sender: string;
  },
): void {
  const [coin] = tx.splitCoins(params.source, [
    tx.pure.u64(toDusdcU64(params.amountDusdc)),
  ]);
  const lp = tx.moveCall({
    target: TARGETS.supply,
    typeArguments: [DUSDC],
    arguments: [tx.object(OBJECTS.predict), coin, tx.object(OBJECTS.clock)],
  });
  tx.transferObjects([lp], tx.pure.address(params.sender));
}

interface RangeLeg {
  oracleId: string;
  expiryMs: number;
  lowerStrikeUsd: number;
  higherStrikeUsd: number;
  /** contract quantity (u64) */
  quantity: number | string;
}

/**
 * Add a deposit + mint_range pair to an existing tx. Deposits `depositDusdc` into
 * the manager, then mints the range; the mint cost is auto-withdrawn from the
 * manager balance, any remainder stays as withdrawable manager balance.
 */
export function addDepositMintRange(
  tx: Transaction,
  params: {
    managerId: string;
    depositCoin: TransactionObjectArgument;
    leg: RangeLeg;
  },
): void {
  const { managerId, depositCoin, leg } = params;

  tx.moveCall({
    target: TARGETS.managerDeposit,
    typeArguments: [DUSDC],
    arguments: [tx.object(managerId), depositCoin],
  });

  const key = tx.moveCall({
    target: TARGETS.rangeKeyNew,
    arguments: [
      tx.pure.id(leg.oracleId),
      tx.pure.u64(leg.expiryMs),
      tx.pure.u64(toStrikeU64(leg.lowerStrikeUsd)),
      tx.pure.u64(toStrikeU64(leg.higherStrikeUsd)),
    ],
  });

  tx.moveCall({
    target: TARGETS.mintRange,
    typeArguments: [DUSDC],
    arguments: [
      tx.object(OBJECTS.predict),
      tx.object(managerId),
      tx.object(leg.oracleId),
      key,
      tx.pure.u64(leg.quantity),
      tx.object(OBJECTS.clock),
    ],
  });
}

/** Redeem a settled binary position on someone's behalf (keeper). */
export function buildRedeemPermissionlessTx(params: {
  managerId: string;
  oracleId: string;
  expiryMs: number;
  strikeUsd: number;
  isUp: boolean;
  quantity: number | string;
}): Transaction {
  const tx = new Transaction();
  const key = tx.moveCall({
    target: params.isUp ? TARGETS.marketKeyUp : TARGETS.marketKeyDown,
    arguments: [
      tx.pure.id(params.oracleId),
      tx.pure.u64(params.expiryMs),
      tx.pure.u64(toStrikeU64(params.strikeUsd)),
    ],
  });
  tx.moveCall({
    target: TARGETS.redeemPermissionless,
    typeArguments: [DUSDC],
    arguments: [
      tx.object(OBJECTS.predict),
      tx.object(params.managerId),
      tx.object(params.oracleId),
      key,
      tx.pure.u64(params.quantity),
      tx.object(OBJECTS.clock),
    ],
  });
  return tx;
}

/** Redeem a settled vertical range into the manager balance. */
export function buildRedeemRangeTx(params: {
  managerId: string;
  leg: RangeLeg;
}): Transaction {
  const tx = new Transaction();
  const { managerId, leg } = params;
  const key = tx.moveCall({
    target: TARGETS.rangeKeyNew,
    arguments: [
      tx.pure.id(leg.oracleId),
      tx.pure.u64(leg.expiryMs),
      tx.pure.u64(toStrikeU64(leg.lowerStrikeUsd)),
      tx.pure.u64(toStrikeU64(leg.higherStrikeUsd)),
    ],
  });
  tx.moveCall({
    target: TARGETS.redeemRange,
    typeArguments: [DUSDC],
    arguments: [
      tx.object(OBJECTS.predict),
      tx.object(managerId),
      tx.object(leg.oracleId),
      key,
      tx.pure.u64(leg.quantity),
      tx.object(OBJECTS.clock),
    ],
  });
  return tx;
}

interface BinaryLeg {
  oracleId: string;
  expiryMs: number;
  strikeUsd: number;
  isUp: boolean;
  /** contract quantity (u64) */
  quantity: number | string;
}

/**
 * Add a deposit + mint (binary position) pair to an existing tx.
 * Deposits `depositCoin` into the manager, then mints a binary Up or Down
 * position at `strikeUsd`. Cost is auto-withdrawn from the manager balance.
 */
export function addDepositMintBinary(
  tx: Transaction,
  params: {
    managerId: string;
    depositCoin: TransactionObjectArgument;
    leg: BinaryLeg;
  },
): void {
  const { managerId, depositCoin, leg } = params;

  tx.moveCall({
    target: TARGETS.managerDeposit,
    typeArguments: [DUSDC],
    arguments: [tx.object(managerId), depositCoin],
  });

  const key = tx.moveCall({
    target: leg.isUp ? TARGETS.marketKeyUp : TARGETS.marketKeyDown,
    arguments: [
      tx.pure.id(leg.oracleId),
      tx.pure.u64(leg.expiryMs),
      tx.pure.u64(toStrikeU64(leg.strikeUsd)),
    ],
  });

  tx.moveCall({
    target: TARGETS.mint,
    typeArguments: [DUSDC],
    arguments: [
      tx.object(OBJECTS.predict),
      tx.object(managerId),
      tx.object(leg.oracleId),
      key,
      tx.pure.u64(leg.quantity),
      tx.object(OBJECTS.clock),
    ],
  });
}

/**
 * Withdraw `amountDusdc` from the manager's internal balance back to the caller.
 * The withdraw_cap is held internally by the PredictManager, so the caller only
 * needs to be the owner.
 */
export function buildWithdrawFromManagerTx(params: {
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

/** Build a redeem (binary) tx — sells the position back to the vault. */
export function buildRedeemBinaryTx(params: {
  managerId: string;
  oracleId: string;
  expiryMs: number;
  strikeUsd: number;
  isUp: boolean;
  quantity: number | string;
}): Transaction {
  const tx = new Transaction();
  const key = tx.moveCall({
    target: params.isUp ? TARGETS.marketKeyUp : TARGETS.marketKeyDown,
    arguments: [
      tx.pure.id(params.oracleId),
      tx.pure.u64(params.expiryMs),
      tx.pure.u64(toStrikeU64(params.strikeUsd)),
    ],
  });
  tx.moveCall({
    target: TARGETS.redeem,
    typeArguments: [DUSDC],
    arguments: [
      tx.object(OBJECTS.predict),
      tx.object(params.managerId),
      tx.object(params.oracleId),
      key,
      tx.pure.u64(params.quantity),
      tx.object(OBJECTS.clock),
    ],
  });
  return tx;
}

export type { RangeLeg, BinaryLeg };

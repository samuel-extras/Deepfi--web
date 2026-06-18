/**
 * DeepBookClient factory (bound to the connected wallet + optional manager) and
 * the create-BalanceManager PTB. Writes follow the app's devInspect-before-sign
 * pattern (see useComboPTB).
 */
import { Transaction } from "@mysten/sui/transactions";
import { DeepBookClient } from "@mysten/deepbook-v3";
import { DB_NETWORK, DB_PKG, MANAGER_KEY } from "./config";

/**
 * DeepBookClient bound to the connected wallet (+ optionally their manager).
 * The SDK's tx builders/queries take a SuiClient with the v2 core API —
 * dapp-kit's `useSuiClient()` client satisfies it.
 */
export function makeDeepBookClient(
  client: unknown,
  address: string,
  managerId?: string | null
): DeepBookClient {
  return new DeepBookClient({
    client: client as never,
    network: DB_NETWORK,
    address,
    balanceManagers: managerId
      ? { [MANAGER_KEY]: { address: managerId } }
      : {},
  });
}

/**
 * Create + register + share a BalanceManager in one PTB.
 * Registration (registry::register_balance_manager) makes the manager
 * discoverable via `getBalanceManagerIds(owner)` later — from any device.
 */
export function buildCreateManagerTx(): Transaction {
  const tx = new Transaction();
  const manager = tx.moveCall({
    target: `${DB_PKG.DEEPBOOK_PACKAGE_ID}::balance_manager::new`,
  });
  tx.moveCall({
    target: `${DB_PKG.DEEPBOOK_PACKAGE_ID}::balance_manager::register_balance_manager`,
    arguments: [manager, tx.object(DB_PKG.REGISTRY_ID)],
  });
  tx.moveCall({
    target: "0x2::transfer::public_share_object",
    arguments: [manager],
    typeArguments: [
      `${DB_PKG.DEEPBOOK_PACKAGE_ID}::balance_manager::BalanceManager`,
    ],
  });
  return tx;
}

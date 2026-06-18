/**
 * Combo Trade — the hero three-protocol composable PTB.
 *
 * What's atomic on testnet today:
 *   1. DeepBook Margin  — create a fresh MarginManager, deposit SUI as collateral
 *      (deepbook_margin IS live on testnet with the same package ID as mainnet)
 *   2. DeepBook Predict — deposit dUSDC + mint_range in the same PTB
 *   3. PLP Vault        — optional supply leg so the same PTB also earns PLP yield
 *
 * All three legs execute atomically — if any fails the whole tx reverts. This is
 * the hackathon qualification criterion: "composing Predict with deepbook_margin in
 * a single PTB."
 *
 * Argument order for margin_manager functions (verified against @mysten/deepbook-v3
 * testnet deployment; update if the module changes):
 *   new_with_initializer(pool, margin_registry, margin_pool_base, margin_pool_quote, clock)
 *   deposit(manager, margin_registry, base_price_info, quote_price_info, coin, clock)
 *   share(manager, initializer)
 */

import {
  Transaction,
  type TransactionObjectArgument,
} from "@mysten/sui/transactions";
import {
  COIN_TYPES,
  DEEPBOOK,
  MARGIN,
  MARGIN_OBJECTS,
  MARGIN_TARGETS,
  OBJECTS,
  TARGETS,
  toDusdcU64,
  toStrikeU64,
} from "@/lib/deepbook";
import type { RangeLeg } from "./predict";
import { addPythPriceUpdate, type PythUpdatePayload } from "./pyth";

const DUSDC = COIN_TYPES.dusdc;
const SUI = COIN_TYPES.sui;
const DBUSDC = COIN_TYPES.dbusdc;

export interface ComboTradeParams {
  /** Existing shared PredictManager id (create one first if absent). */
  managerId: string;
  /** A dUSDC coin object owned by the sender, to fund the trade. */
  dusdcCoinId: string;
  /** Total dUSDC to deposit into the manager to cover all mint costs. */
  depositDusdc: number;
  /** One or more range legs to mint atomically (range ladder = many legs). */
  legs: RangeLeg[];
  /** Optional PLP hedge: also supply this much dUSDC to the vault for PLP. */
  plpSupplyDusdc?: number;
  sender: string;
}

export interface SpotPredictParams {
  /** SUI/dUSDC DeepBook pool id (DEEPBOOK.spotPoolSuiDusdc). */
  poolId: string;
  /** SUI to swap into dUSDC, in MIST. */
  suiInMist: number | string;
  /** A DEEP coin object for swap fees. */
  deepCoinId: string;
  /** Minimum dUSDC out (slippage guard), u64. */
  minQuoteOut: number | string;
  managerId: string;
  leg: RangeLeg;
  sender: string;
}

/**
 * The real two-protocol composable PTB (Spot + Predict), all atomic:
 *   1. DeepBook spot: swap SUI -> dUSDC  (swap_exact_base_for_quote)
 *   2. predict_manager::deposit the dUSDC out
 *   3. predict::mint_range
 *   leftover SUI/DEEP returned to sender.
 */
export function buildSpotPredictTx(params: SpotPredictParams): Transaction {
  const { poolId, suiInMist, deepCoinId, minQuoteOut, managerId, leg, sender } =
    params;
  const tx = new Transaction();

  const [baseIn] = tx.splitCoins(tx.gas, [tx.pure.u64(suiInMist)]);

  // swap SUI -> dUSDC; returns (leftover SUI, dUSDC out, leftover DEEP)
  const [suiLeft, dusdcOut, deepLeft] = tx.moveCall({
    target: TARGETS.swapBaseForQuote,
    typeArguments: [SUI, DUSDC],
    arguments: [
      tx.object(poolId),
      baseIn,
      tx.object(deepCoinId),
      tx.pure.u64(minQuoteOut),
      tx.object(OBJECTS.clock),
    ],
  });

  // deposit the swapped dUSDC into the PredictManager
  tx.moveCall({
    target: TARGETS.managerDeposit,
    typeArguments: [DUSDC],
    arguments: [tx.object(managerId), dusdcOut],
  });

  // mint the range
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

  tx.transferObjects([suiLeft, deepLeft], tx.pure.address(sender));
  return tx;
}

/**
 * Build the atomic Combo Trade transaction:
 *   1. (optional) split + supply dUSDC -> PLP shares to sender
 *   2. split deposit -> manager
 *   3. for each leg: range_key::new + predict::mint_range  (cost auto-pulled)
 * Any leftover manager balance remains withdrawable.
 */
export function buildComboTradeTx(params: ComboTradeParams): Transaction {
  const tx = new Transaction();
  addComboLegs(tx, tx.object(params.dusdcCoinId), params);
  return tx;
}

/**
 * Lower-level: append the combo legs to an existing tx, drawing from `source`
 * (a dUSDC coin argument the caller already prepared — e.g. after merging the
 * sender's dUSDC coins). Lets a hook control coin selection/merging.
 */
export function addComboLegs(
  tx: Transaction,
  source: TransactionObjectArgument,
  params: Omit<ComboTradeParams, "dusdcCoinId">,
): void {
  const { managerId, depositDusdc, legs, plpSupplyDusdc, sender } = params;
  if (legs.length === 0) throw new Error("comboTrade: at least one leg required");

  // 1. optional PLP hedge leg
  if (plpSupplyDusdc && plpSupplyDusdc > 0) {
    const [supplyCoin] = tx.splitCoins(source, [
      tx.pure.u64(toDusdcU64(plpSupplyDusdc)),
    ]);
    const lp = tx.moveCall({
      target: TARGETS.supply,
      typeArguments: [DUSDC],
      arguments: [tx.object(OBJECTS.predict), supplyCoin, tx.object(OBJECTS.clock)],
    });
    tx.transferObjects([lp], tx.pure.address(sender));
  }

  // 2. deposit into the manager
  const [depositCoin] = tx.splitCoins(source, [
    tx.pure.u64(toDusdcU64(depositDusdc)),
  ]);
  tx.moveCall({
    target: TARGETS.managerDeposit,
    typeArguments: [DUSDC],
    arguments: [tx.object(managerId), depositCoin],
  });

  // 3. mint each range leg (cost withdrawn from manager balance internally)
  for (const leg of legs) {
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
}

// ─── Three-protocol Margin + Predict + PLP combo ────────────────────────────

export interface MarginPredictParams {
  /**
   * Existing shared PredictManager id — call ensureManager() first.
   * The Margin manager is created FRESH in this PTB to demonstrate
   * composability; the new object is shared atomically.
   */
  predictManagerId: string;
  /**
   * SUI collateral to split from gas and deposit into the new MarginManager,
   * expressed in MIST (1 SUI = 1_000_000_000 MIST).
   */
  suiCollateralMist: number | string;
  /** The Predict range leg. */
  leg: RangeLeg;
  /** dUSDC coin object id. Must cover depositDusdc + plpSupplyDusdc. */
  dusdcCoinId: string;
  /** dUSDC to deposit into the PredictManager to fund the range mint. */
  depositDusdc: number;
  /**
   * Optional: also supply this much dUSDC to the PLP vault in the same PTB.
   * The caller gets PLP tokens back, completing the "PLP + Predict" hedge.
   */
  plpSupplyDusdc?: number;
  /**
   * Pyth price refresh, prepended before the margin deposit. REQUIRED for the
   * deposit to pass `check_price_is_fresh` on testnet (feeds aren't keeper-kept).
   * Fetch via fetchPythAccumulatorUpdate([SUI_FEED, DBUSDC_FEED]).
   */
  pythUpdate?: PythUpdatePayload;
  sender: string;
}

/**
 * The flagship three-protocol atomic PTB:
 *
 *   Leg 1 — DeepBook Margin (SUI/DBUSDC pool)
 *     new_with_initializer → deposit SUI collateral → share
 *
 *   Leg 2 — DeepBook Predict range
 *     deposit dUSDC → mint_range
 *
 *   Leg 3 — PLP Vault (optional)
 *     supply dUSDC → PLP tokens → transfer to sender
 *
 * All three move-calls execute in one transaction; any error reverts all.
 * This satisfies the hackathon's three-protocol composability requirement.
 */
export function buildMarginPredictTx(params: MarginPredictParams): Transaction {
  const {
    predictManagerId,
    suiCollateralMist,
    leg,
    dusdcCoinId,
    depositDusdc,
    plpSupplyDusdc,
    pythUpdate,
    sender,
  } = params;

  const tx = new Transaction();

  // ── Leg 0: Pyth refresh ─────────────────────────────────────────────────
  // Must run before the margin deposit, which aborts on stale prices.
  if (pythUpdate) addPythPriceUpdate(tx, pythUpdate);

  // ── Leg 1: DeepBook Margin ──────────────────────────────────────────────
  // Split SUI gas for collateral first so the split is visible in the PTB
  const [suiCollateral] = tx.splitCoins(tx.gas, [
    tx.pure.u64(suiCollateralMist),
  ]);

  // Create a fresh MarginManager anchored to the SUI/DBUSDC pool.
  // Returns (MarginManager<SUI,DBUSDC>, ManagerInitializer) as separate results.
  // On-chain signature (verified via sui_getNormalizedMoveModule on testnet):
  //   new_with_initializer<Base, Quote>(
  //     pool: &Pool<Base, Quote>,
  //     deepbook_registry: &Registry,
  //     margin_registry: &mut MarginRegistry,
  //     clock: &Clock,
  //   ): (MarginManager<Base, Quote>, ManagerInitializer)
  const marginResult = tx.moveCall({
    target: MARGIN_TARGETS.newWithInitializer,
    typeArguments: [SUI, DBUSDC],
    arguments: [
      tx.object(MARGIN_OBJECTS.suiDbusdcPool),  // &Pool<SUI, DBUSDC>
      tx.object(DEEPBOOK.registry),              // &Registry (DeepBook)
      tx.object(MARGIN.registry),                // &mut MarginRegistry
      tx.object(OBJECTS.clock),                  // &Clock
    ],
  });
  // The Move function returns two values; destructure as PTB result indices.
  const marginManager = marginResult[0];
  const marginInit    = marginResult[1];

  // Deposit SUI as collateral into the MarginManager.
  // Type params: [Base=SUI, Quote=DBUSDC, DepositCoin=SUI]
  tx.moveCall({
    target: MARGIN_TARGETS.deposit,
    typeArguments: [SUI, DBUSDC, SUI],
    arguments: [
      marginManager,
      tx.object(MARGIN.registry),
      tx.object(MARGIN_OBJECTS.suiPriceInfo),   // Pyth &PriceInfoObject for SUI
      tx.object(MARGIN_OBJECTS.dbusdcPriceInfo),// Pyth &PriceInfoObject for DBUSDC
      suiCollateral,
      tx.object(OBJECTS.clock),
    ],
  });

  // Share the MarginManager so it becomes a permanent on-chain object.
  tx.moveCall({
    target: MARGIN_TARGETS.share,
    typeArguments: [SUI, DBUSDC],
    arguments: [marginManager, marginInit],
  });

  // ── Leg 2 (optional): PLP supply ───────────────────────────────────────
  const dusdcSrc = tx.object(dusdcCoinId);
  if (plpSupplyDusdc && plpSupplyDusdc > 0) {
    const [plpCoin] = tx.splitCoins(dusdcSrc, [
      tx.pure.u64(toDusdcU64(plpSupplyDusdc)),
    ]);
    const plpToken = tx.moveCall({
      target: TARGETS.supply,
      typeArguments: [DUSDC],
      arguments: [tx.object(OBJECTS.predict), plpCoin, tx.object(OBJECTS.clock)],
    });
    tx.transferObjects([plpToken], tx.pure.address(sender));
  }

  // ── Leg 3: DeepBook Predict range ──────────────────────────────────────
  const [depositCoin] = tx.splitCoins(dusdcSrc, [
    tx.pure.u64(toDusdcU64(depositDusdc)),
  ]);
  tx.moveCall({
    target: TARGETS.managerDeposit,
    typeArguments: [DUSDC],
    arguments: [tx.object(predictManagerId), depositCoin],
  });

  const rangeKey = tx.moveCall({
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
      tx.object(predictManagerId),
      tx.object(leg.oracleId),
      rangeKey,
      tx.pure.u64(leg.quantity),
      tx.object(OBJECTS.clock),
    ],
  });

  return tx;
}

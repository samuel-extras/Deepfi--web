/**
 * DeepBook / Predict on-chain configuration — REAL testnet IDs.
 * Pinned to the `predict-testnet-4-16` branch of MystenLabs/deepbookv3.
 * Source: docs.sui.io/onchain-finance/deepbook-predict/contract-information
 *
 * NOTE: deepbook_margin IS live on testnet (package + MarginRegistry below,
 * verified via on-chain ABI). The three-protocol atomic PTB we ship spans
 * deepbook_margin (SUI collateral) + deepbook_predict (range) + PLP supply in a
 * single transaction. The margin deposit reads Pyth price feeds, which on testnet
 * are not keeper-refreshed, so the combo PTB first refreshes them from a Hermes
 * VAA (see lib/ptb/pyth.ts) to pass `check_price_is_fresh`.
 */

export const SUI_NETWORK = "testnet" as const;

export const DUSDC_FAUCET_URL = "https://tally.so/r/Xx102L";

export const PREDICT_INDEXER_URL =
  "https://predict-server.testnet.mystenlabs.com";

/** Real testnet package + object IDs (predict-testnet-4-16). */
export const PACKAGES = {
  predict: "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138",
  dusdc: "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a",
} as const;

export const OBJECTS = {
  /** The shared Predict object (vault + config + registry of oracles). */
  predict: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
  predictRegistry:
    "0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64",
  dusdcTreasuryCap:
    "0x64f8a47a0af0a3b14db3a7ce89aa206ff77a9c6b5ac0eaef6db2ea46da3ced94",
  dusdcCurrency:
    "0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c",
  clock: "0x6",
} as const;

/** DeepBook v3 (VERIFIED, testnet) — for the spot-swap leg. */
export const DEEPBOOK = {
  pkg: "0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c",
  registry: "0x7c256edbda983a2cd6f946655f4bf3f00a41043993781f8674a7046e8c0e11d1",
  deepTreasury: "0x69fffdae0075f8f71f4fa793549c11079266910e8905169845af1f5d00e09dcb",
  /** SUI/dUSDC pool we deploy (filled from env after deploy). */
  spotPoolSuiDusdc: process.env.NEXT_PUBLIC_SPOT_POOL_SUI_DUSDC ?? "",
} as const;

/**
 * Existing DeepBook V3 spot pools on **testnet** (verified live, Shared objects;
 * IDs from @mysten/deepbook-v3 constants). NOTE: DeepBook testnet is quoted in
 * **DBUSDC**, which is a DIFFERENT coin from Predict's **dUSDC**. So these pools
 * power the spot-trading UI directly (reads are free), but the composable
 * spot→predict combo still needs dUSDC for the predict leg.
 */
export const SPOT_POOLS = {
  SUI_DBUSDC: "0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5",
  DBTC_DBUSDC: "0x0dce0aa771074eb83d1f4a29d48be8248d4d2190976a5241f66b43ec18fa34de",
  DEEP_DBUSDC: "0xe86b991f8632217505fd859445f9803967ac84a9d4a1219065bf191fcb74b622",
  DBUSDT_DBUSDC: "0x83970bb02e3636efdff8c141ab06af5e3c9a22e2f74d7f02a9c3430d0d10c1ca",
  WAL_DBUSDC: "0xeb524b6aea0ec4b494878582e0b78924208339d360b62aec4a8ecd4031520dbb",
  DEEP_SUI: "0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f",
  WAL_SUI: "0x8c1c1b186c4fddab1ebd53e0895a36c1d1b3b9a77cd34e607bef49a38af0150a",
} as const;

/**
 * deepbook_margin — LIVE on Sui testnet.
 * Package + registry IDs from @mysten/deepbook-v3 testnetPackageIds.
 * The margin_manager module handles collateral + borrow; each manager is
 * anchored to a specific DeepBook spot pool (e.g. SUI/DBUSDC).
 */
export const MARGIN = {
  pkg: "0xd6a42f4df4db73d68cbeb52be66698d2fe6a9464f45ad113ca52b0c6ebd918b6",
  registry: "0x48d7640dfae2c6e9ceeada197a7a1643984b5a24c55a0c6c023dac77e0339f75",
} as const;

/**
 * Objects required to open/manage a SUI-collateral margin position on the
 * SUI/DBUSDC DeepBook spot pool (testnet).
 * Source: @mysten/deepbook-v3 testnetPools + testnetCoins + testnetMarginPools.
 */
export const MARGIN_OBJECTS = {
  /** SUI/DBUSDC DeepBook pool — the anchor pool for margin managers. */
  suiDbusdcPool:
    "0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5",
  /** SUI margin lending pool (testnetMarginPools.SUI.address). */
  suiMarginPool:
    "0xcdbbe6a72e639b647296788e2e4b1cac5cea4246028ba388ba1332ff9a382eea",
  /** DBUSDC margin lending pool (testnetMarginPools.DBUSDC.address). */
  dbusdcMarginPool:
    "0xf08568da93834e1ee04f09902ac7b1e78d3fdf113ab4d2106c7265e95318b14d",
  /** Pyth price info object for SUI (testnetCoins.SUI.priceInfoObjectId). */
  suiPriceInfo:
    "0x1ebb295c789cc42b3b2a1606482cd1c7124076a0f5676718501fda8c7fd075a0",
  /** Pyth price info object for DBUSDC (testnetCoins.DBUSDC.priceInfoObjectId). */
  dbusdcPriceInfo:
    "0x9c4dd4008297ffa5e480684b8100ec21cc934405ed9a25d4e4d7b6259aad9c81",
} as const;

/** Move call targets for deepbook_margin::margin_manager (testnet). */
export const MARGIN_TARGETS = {
  newWithInitializer: `${MARGIN.pkg}::margin_manager::new_with_initializer`,
  share:              `${MARGIN.pkg}::margin_manager::share`,
  deposit:            `${MARGIN.pkg}::margin_manager::deposit`,
  borrowBase:         `${MARGIN.pkg}::margin_manager::borrow_base`,
  borrowQuote:        `${MARGIN.pkg}::margin_manager::borrow_quote`,
  repayBase:          `${MARGIN.pkg}::margin_manager::repay_base`,
  repayQuote:         `${MARGIN.pkg}::margin_manager::repay_quote`,
  withdraw:           `${MARGIN.pkg}::margin_manager::withdraw`,
} as const;

/**
 * Pyth oracle (Sui TESTNET) — needed to refresh price feeds before a margin
 * deposit, which aborts on `pyth::check_price_is_fresh` (~60s staleness window).
 *
 * Sui testnet's Pyth feeds are fed from Pyth's TESTNET, served by the
 * **hermes-beta** endpoint (the production hermes.pyth.network does NOT carry
 * these feed IDs). Package/state IDs resolved from the on-chain Pyth + Wormhole
 * state objects' upgrade caps; function signatures verified against the deployed
 * ABI via sui_getNormalizedMoveModule. baseUpdateFee read from Pyth State.
 */
export const PYTH = {
  hermes: "https://hermes-beta.pyth.network",
  pkg: "0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837",
  state: "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
  wormholePkg: "0x21473617f3565d704aa67be73ea41243e9e34a42d434c31f8182c67ba01ccf49",
  wormholeState: "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
  baseUpdateFee: 1, // MIST per feed
  /** 32-byte Pyth price-feed identifiers (extracted from the on-chain PriceInfoObjects). */
  feeds: {
    sui:    "0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266",
    dbusdc: "0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722",
  },
} as const;

/** Pyth/Wormhole Move call targets (testnet). */
export const PYTH_TARGETS = {
  parseAndVerify:        `${PYTH.wormholePkg}::vaa::parse_and_verify`,
  createPriceInfosAccum: `${PYTH.pkg}::pyth::create_authenticated_price_infos_using_accumulator`,
  updateSinglePriceFeed: `${PYTH.pkg}::pyth::update_single_price_feed`,
  hotPotatoDestroy:      `${PYTH.pkg}::hot_potato_vector::destroy`,
  priceInfoType:         `${PYTH.pkg}::price_info::PriceInfo`,
} as const;

/** Coin types. dUSDC is the Predict quote asset (NOT official testnet USDC). */
export const COIN_TYPES = {
  dusdc: `${PACKAGES.dusdc}::dusdc::DUSDC`,
  plp: `${PACKAGES.predict}::plp::PLP`,
  sui: "0x2::sui::SUI",
  deep: "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP",
  // DeepBook V3 testnet spot quote/base coins (distinct from Predict's dUSDC)
  dbusdc: "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC",
  dbusdt: "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDT::DBUSDT",
  dbtc: "0x6502dae813dbe5e42643c119a6450a518481f03063febc7e20238e43b6ea9e86::dbtc::DBTC",
} as const;

/** Move call targets. */
export const TARGETS = {
  createManager: `${PACKAGES.predict}::predict::create_manager`,
  managerDeposit: `${PACKAGES.predict}::predict_manager::deposit`,
  managerWithdraw: `${PACKAGES.predict}::predict_manager::withdraw`,
  mint: `${PACKAGES.predict}::predict::mint`,
  mintRange: `${PACKAGES.predict}::predict::mint_range`,
  redeem: `${PACKAGES.predict}::predict::redeem`,
  redeemRange: `${PACKAGES.predict}::predict::redeem_range`,
  redeemPermissionless: `${PACKAGES.predict}::predict::redeem_permissionless`,
  supply: `${PACKAGES.predict}::predict::supply`,
  withdraw: `${PACKAGES.predict}::predict::withdraw`,
  getTradeAmounts: `${PACKAGES.predict}::predict::get_trade_amounts`,
  getRangeTradeAmounts: `${PACKAGES.predict}::predict::get_range_trade_amounts`,
  marketKeyUp: `${PACKAGES.predict}::market_key::up`,
  marketKeyDown: `${PACKAGES.predict}::market_key::down`,
  rangeKeyNew: `${PACKAGES.predict}::range_key::new`,
  swapBaseForQuote: `${DEEPBOOK.pkg}::pool::swap_exact_base_for_quote`,
} as const;

/** Fixed-point scales used on-chain. */
export const PRICE_SCALE = 1_000_000_000; // strikes & oracle prices: 1e9 = $1
export const DUSDC_DECIMALS = 6;
export const DUSDC_SCALE = 1_000_000; // dUSDC: 1e6 = 1 dUSDC

/** Rolling sub-hour expiries the protocol offers (minutes). */
export const EXPIRIES_MIN = [5, 15, 30, 60] as const;

export const MAX_LEVERAGE = 3;
export const MIN_LEVERAGE = 1;

/** Convert a USD strike (e.g. 70500) to on-chain u64 (1e9 scale). */
export function toStrikeU64(usd: number): string {
  return BigInt(Math.round(usd * PRICE_SCALE)).toString();
}

/** Convert on-chain 1e9 price/strike to USD number. */
export function fromPriceU64(raw: number | string): number {
  return Number(raw) / PRICE_SCALE;
}

/** Convert dUSDC amount (e.g. 1000.5) to on-chain u64 (1e6 scale). */
export function toDusdcU64(amount: number): string {
  return BigInt(Math.round(amount * DUSDC_SCALE)).toString();
}

/** Convert on-chain dUSDC u64 to a number. */
export function fromDusdcU64(raw: number | string): number {
  return Number(raw) / DUSDC_SCALE;
}

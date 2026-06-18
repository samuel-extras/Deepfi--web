/**
 * Deploy config for the full-stack testnet stack (Spot + Margin + Predict).
 * IDs marked VERIFIED are confirmed from the predict-testnet-4-16 repo / live
 * indexer / DeepBook TS SDK. IDs marked TODO are produced by the deploy steps
 * or must be fetched (Pyth feeds) — filled in during the funded deploy session.
 */

export const NETWORK = "testnet" as const;
export const RPC = "https://fullnode.testnet.sui.io:443";

// ---- DeepBook v3 (VERIFIED, testnet) ----
export const DEEPBOOK = {
  pkg: "0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c",
  registry: "0x7c256edbda983a2cd6f946655f4bf3f00a41043993781f8674a7046e8c0e11d1",
  deepTreasury: "0x69fffdae0075f8f71f4fa793549c11079266910e8905169845af1f5d00e09dcb",
  deepType:
    "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP",
} as const;

// ---- coin types ----
export const SUI_TYPE = "0x2::sui::SUI";
export const DUSDC_TYPE =
  "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC";

// ---- Predict (VERIFIED, testnet) ----
export const PREDICT = {
  pkg: "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138",
  object: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
  registry: "0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64",
  dusdcTreasuryCap:
    "0x64f8a47a0af0a3b14db3a7ce89aa206ff77a9c6b5ac0eaef6db2ea46da3ced94",
} as const;

// ---- Pyth (testnet) — for deepbook_margin price feeds ----
// dUSDC has NO feed; we map dUSDC -> Pyth USDC/USD (~$1). Fill these from
// https://docs.pyth.network (Sui testnet) + price feed ids during deploy.
export const PYTH = {
  pkg: "0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837",
  state: "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
  wormholePkg: "0xf47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94",
  wormholeState: "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
  // PriceInfoObject ids (created/owned after a price update)
  suiUsdPriceInfo: "TODO_PYTH_SUI_USD_PRICEINFO",
  usdcUsdPriceInfo: "TODO_PYTH_USDC_USD_PRICEINFO",
  // feed ids (hex)
  suiUsdFeedId: "TODO_PYTH_SUI_USD_FEED_ID",
  usdcUsdFeedId: "TODO_PYTH_USDC_USD_FEED_ID",
} as const;

// ---- SUI/dUSDC spot pool params (base=SUI 9dp, quote=dUSDC 6dp) ----
export const SPOT_POOL_PARAMS = {
  tickSize: 1_000_000, // quote ticks (tune on deploy)
  lotSize: 100_000_000, // 0.1 SUI base lots
  minSize: 100_000_000,
} as const;

// ---- outputs (filled by deploy steps) ----
export const OUTPUT = {
  spotPoolSuiDusdc: "TODO_AFTER_01",
  marginPkg: "TODO_AFTER_02",
  marginRegistry: "TODO_AFTER_02",
  marginAdminCap: "TODO_AFTER_02",
  marginPoolSui: "TODO_AFTER_03",
  marginPoolDusdc: "TODO_AFTER_03",
} as const;

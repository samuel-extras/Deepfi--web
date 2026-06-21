/**
 * STUB — the verbatim dex OpenOrderCard fetches market metadata from here to
 * enrich order rows. deepfi has no open-order feed yet (the Open Orders tab is
 * empty), so these resolve to null. Wire to deepfi's predict markets when ready.
 */
export async function fetchPolymarketMarket(
  _marketId: string,
): Promise<any | null> {
  return null;
}

export async function fetchPolymarketMarketByTokenId(
  _tokenId: string,
): Promise<any | null> {
  return null;
}

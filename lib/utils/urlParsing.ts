export const MARKET_TYPES = {
  PERPS: "perps",
  SPOT: "spot",
} as const;

export type MarketType = (typeof MARKET_TYPES)[keyof typeof MARKET_TYPES];

export const DEFAULT_SYMBOL = "BTC";

export const SPECIAL_SYMBOLS = [
  "kBONK",
  "kPEPE",
  "kLUNC",
  "kFLOKI",
  "kNEIRO",
  "kSHIB",
] as const;

/**
 * Normalize symbol: case-insensitive check against SPECIAL_SYMBOLS.
 * If it matches, enforce the lowercase 'k' prefix and keep the remainder as-is.
 * For prefixed symbols (e.g., "xyz:NVDA"), preserves the prefix and normalizes the base.
 * For other symbols, converts to uppercase.
 */
export function normalizeSymbol(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // Handle prefixed symbols (e.g., "xyz:nvda" -> "xyz:NVDA")
  if (trimmed.includes(":")) {
    const parts = trimmed?.split(":");
    if (parts.length === 2) {
      const [prefix, base] = parts;
      return `${prefix.toLowerCase()}:${base.toUpperCase()}`;
    }
  }

  // Build a lookup map like { kbonk: "kBONK", ... }
  const map = SPECIAL_SYMBOLS.reduce<Record<string, string>>((acc, s) => {
    acc[s.toLowerCase()] = s;
    return acc;
  }, {});

  const matched = map[lower];
  if (matched) {
    // Convert the matched version: lowercase 'k' prefix, uppercase the rest
    return "k" + matched.slice(1).toUpperCase();
  }

  // Not a special symbol → convert to uppercase
  return trimmed.toUpperCase();
}

export interface ParsedTradeRoute {
  symbol: string;
  marketType: MarketType;
  coinId?: string;
}

/**
 * Parses trade route parameters to extract symbol, market type, and optional coinId.
 *
 * Logic:
 * - `[]` or undefined → defaults (BTC perps)
 * - `[BTC]` → perps market
 * - `[BTC, USDC]` → spot market
 */
export function parseTradeRouteParams(
  params: string[] | undefined
): ParsedTradeRoute {
  // Handle empty or undefined params - defaults to DEFAULT_SYMBOL perps
  if (!params || params.length === 0) {
    return {
      symbol: DEFAULT_SYMBOL,
      marketType: MARKET_TYPES.PERPS,
    };
  }

  // Normalize and decode the first param (symbol)
  const rawSymbol = params[0] || "";
  const symbol = normalizeSymbol(decodeURIComponent(rawSymbol));

  // If only one param, it's a perps market
  if (params.length === 1) {
    return {
      symbol: symbol || DEFAULT_SYMBOL, // Fallback to DEFAULT_SYMBOL if empty
      marketType: MARKET_TYPES.PERPS,
    };
  }

  // If two params, it's a spot market (e.g., [BTC, USDC])
  // The second param should be USDC, but we only need the first param (symbol)
  return {
    symbol: symbol || DEFAULT_SYMBOL, // Fallback to DEFAULT_SYMBOL if empty
    marketType: MARKET_TYPES.SPOT,
    // coinId will be resolved later when markets are loaded
  };
}

/**
 * Builds a trade route URL from symbol and market type.
 */
export function buildTradeRoute(
  symbol: string,
  marketType: MarketType
): string {
  const normalizedSymbol = normalizeSymbol(symbol);

  // For prefixed symbols with colons, don't encode the colon
  let encodedSymbol: string;
  if (normalizedSymbol.includes(":")) {
    const [prefix, base] = normalizedSymbol.split(":");
    encodedSymbol = `${encodeURIComponent(prefix)}:${encodeURIComponent(base)}`;
  } else {
    encodedSymbol = encodeURIComponent(normalizedSymbol);
  }

  if (marketType === MARKET_TYPES.SPOT) {
    return `/trade/${encodedSymbol}/USDC`;
  }

  return `/trade/${encodedSymbol}`;
}

/**
 * Updates the browser URL to the specified trade route without triggering Next.js navigation.
 * This prevents component remounts while still updating the URL for bookmarking/sharing.
 *
 * @param route - The trade route URL (e.g., "/trade/BTC" or "/trade/BTC/USDC")
 */
export function updateTradeRoute(route: string): void {
  window.history.replaceState(null, "", route);
}

/**
 * Parses the market type from a pathname.
 *
 * @param pathname - The current pathname (e.g., "/trade/BTC" or "/trade/BTC/USDC")
 * @returns The market type or undefined if not a trade route
 */
export function parseMarketTypeFromPathname(
  pathname: string
): MarketType | undefined {
  if (!pathname.startsWith("/trade")) {
    return undefined;
  }

  const segments = pathname.split("/").filter(Boolean);
  // segments: ["trade", "BTC"] or ["trade", "BTC", "USDC"]

  if (segments.length < 2) {
    return undefined; // Just "/trade" or invalid
  }

  // Count segments after "trade"
  const paramsCount = segments.length - 1;

  if (paramsCount === 1) {
    return MARKET_TYPES.PERPS;
  }

  if (paramsCount === 2) {
    return MARKET_TYPES.SPOT;
  }

  return undefined;
}

/**
 * Extracts the symbol from a trade route pathname.
 */
export function getSymbolFromPathname(pathname: string): string | undefined {
  if (!pathname.startsWith("/trade")) {
    return undefined;
  }

  const segments = pathname.split("/").filter(Boolean);
  // segments: ["trade", "BTC"] or ["trade", "BTC", "USDC"]

  if (segments.length < 2) {
    return undefined; // Just "/trade" or invalid
  }

  const symbolParam = segments[1];
  if (!symbolParam) {
    return undefined;
  }

  try {
    return normalizeSymbol(decodeURIComponent(symbolParam));
  } catch {
    return normalizeSymbol(symbolParam);
  }
}

/**
 * Builds a redirect URL with preserved query parameters.
 * Useful for server-side redirects that need to maintain query params like referralCode.
 */
export async function buildRedirectUrlWithParams(
  targetPath: string,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
): Promise<string> {
  const params = await searchParams;
  const queryString = new URLSearchParams(
    params as Record<string, string>
  ).toString();

  return queryString ? `${targetPath}?${queryString}` : targetPath;
}

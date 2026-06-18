// Exception maps between display and API symbols
const API_SYMBOL_EXCEPTIONS: Record<string, string> = {
  BONK: "KBONK",
  USDC: "USDC",
  MON: "UMON",
  ENA: "UENA",
  XPL: "UXPL",
  USDT: "USDT0",
  XAUT: "XAUT0",
  KNTQ: "NTQ",
  PENGU: "HPENGU",
};

const DISPLAY_SYMBOL_EXCEPTIONS: Record<string, string> = {
  KBONK: "BONK",
  UBONK: "BONK",
  USDC: "USDC",
  UMON: "MON",
  UENA: "ENA",
  UXPL: "XPL",
  USDT0: "USDT",
  XAUT0: "XAUT",
  NTQ: "KNTQ",
  HPENGU: "PENGU",
};

// Known wrapped tokens that have U-prefix in DeepBook API
// Only these tokens should have U stripped when converting from API to display
export const KNOWN_WRAPPED_TOKENS = [
  "BTC",
  "ETH",
  "SOL",
  "ADA",
  "AVAX",
  "BNB",
  "TRX",
  "LTC",
  "ATOM",
  "NEAR",
  "TIA",
  "XRP",
  "DOT",
  "MATIC",
  "ALGO",
  "ICP",
  "PUMP",
];

function normalize(input: string): string {
  return (input || "").trim().toUpperCase();
}

/**
 * Convert a display symbol to the DeepBook API symbol.
 * Examples: BTC -> UBTC, BONK -> KBONK, USDC -> USDC, UBTC -> UBTC
 * Tokens like UPUMP, UFART stay as-is (they legitimately start with U)
 */
export function toDeepBookSymbol(symbol: string | undefined): string {
  if (!symbol) return "";

  const s = normalize(symbol);
  if (!s) return "";

  // Check explicit exceptions first
  if (s in API_SYMBOL_EXCEPTIONS) return API_SYMBOL_EXCEPTIONS[s];

  // If it's a known wrapped token, add U prefix
  if (KNOWN_WRAPPED_TOKENS.includes(s)) return `U${s}`;

  // Otherwise return as-is (includes tokens that legitimately start with U like UPUMP, UFART)
  return s;
}

/**
 * Convert a DeepBook API symbol to a display symbol.
 * Examples: UBTC -> BTC, KBONK -> BONK, USDC -> USDC, BTC -> BTC
 * Tokens like UPUMP, UFART stay as-is (they legitimately start with U)
 */
export function fromDeepBookSymbol(apiSymbol: string): string {
  const s = normalize(apiSymbol);
  if (!s) return "";

  // Check explicit exceptions first
  if (s in DISPLAY_SYMBOL_EXCEPTIONS) return DISPLAY_SYMBOL_EXCEPTIONS[s];

  // Only strip U prefix if it's a known wrapped token
  if (s.startsWith("U") && s.length > 1) {
    const withoutU = s.slice(1);
    if (KNOWN_WRAPPED_TOKENS.includes(withoutU)) {
      return withoutU;
    }
  }

  // Keep tokens that legitimately start with U (like UPUMP, UFART, USDE, etc.)
  return s;
}

export function truncateId(
  value: string,
  head: number = 6,
  tail: number = 4
): string {
  if (!value) return "";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

type FormatNumberMode = "price" | "amount" | "percent" | "default";

interface FormatNumberOptions {
  showSign?: boolean;
  compact?: boolean;
  symbol?: string;
  symbolPosition?: "prefix" | "suffix";
  locale?: string;
  precision?: number;
  minimumFractionDigits?: number;
  round?: boolean;
}

/**
 * Options:
 * - showSign: adds + or - sign where applicable
 * - compact: shortens large numbers (e.g. 1234000 → 1.23M)
 * - symbol: currency or token label (e.g. "$", "BTC", "USDC")
 * - symbolPosition: "prefix" | "suffix" (default: suffix)
 * - locale: locale for formatting (default: "en-US")
 * - precision: maximum number of decimal places
 * - minimumFractionDigits: minimum number of decimal places (keeps trailing zeros)
 * - round: if true, rounds to precision; if false (default), truncates
 */
export function formatNumber(
  value: number | string | null | undefined,
  mode: FormatNumberMode = "default",
  {
    showSign = false,
    compact = false,
    symbol,
    symbolPosition = "prefix",
    locale = "en-US",
    precision,
    minimumFractionDigits,
    round = false,
  }: FormatNumberOptions = {}
): string {
  const num = Number(value);

  if (!isFinite(num) || num === null) return "0";

  if (num === 0) {
    let formatted: string;

    if (minimumFractionDigits !== undefined && minimumFractionDigits > 0) {
      // Use minimumFractionDigits for zero formatting
      formatted = "0." + "0".repeat(minimumFractionDigits);
      if (mode === "percent") formatted += "%";
    } else {
      const zeroFormats: Record<FormatNumberMode, string> = {
        percent: "0.00%",
        price: "0.00",
        amount: "0",
        default: "0",
      };
      formatted = zeroFormats[mode];
    }

    if (mode === "price" && symbol) {
      return symbolPosition === "suffix"
        ? `${formatted} ${symbol}`
        : `${symbol}${formatted}`;
    }

    return formatted;
  }

  const abs = Math.abs(num);
  let maxDecimals = 6;

  const PRECISION_RULES = {
    price: () => {
      if (abs >= 100) return 2;
      if (abs >= 1) return 4;
      if (abs >= 0.01) return 6;
      if (abs >= 0.0001) return 8;
      return 10;
    },
    amount: () => {
      if (abs >= 1000) return 0;
      if (abs >= 1) return 3;
      if (abs >= 0.001) return 5;
      return 8;
    },
    percent: () => {
      if (abs >= 1) return 2;
      if (abs >= 0.1) return 3;
      if (abs >= 0.01) return 4;
      if (abs >= 0.001) return 5;
      if (abs >= 0.00001) return 6;
      return 8;
    },
    default: () => 6,
  };

  maxDecimals =
    precision !== undefined ? precision : (PRECISION_RULES[mode]?.() ?? 6);

  if (compact && abs >= 1000) {
    return Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 2,
      signDisplay: showSign ? "always" : "auto",
    }).format(num);
  }

  // Round or truncate to maxDecimals
  const factor = Math.pow(10, maxDecimals);
  const processed = round
    ? Math.round(num * factor) / factor
    : Math.trunc(num * factor) / factor;
  let str = processed.toFixed(maxDecimals);

  // Only trim trailing zeros if minimumFractionDigits is not specified
  if (minimumFractionDigits === undefined) {
    str = str.replace(/(\.\d*?[1-9])0+$/, "$1"); // trim trailing zeros
    str = str.replace(/\.0+$/, ""); // remove ".0"
  } else if (minimumFractionDigits > 0) {
    // Ensure we have at least minimumFractionDigits decimal places
    const [intPart, decPart = ""] = str?.split(".") || [];
    const paddedDec = decPart.padEnd(minimumFractionDigits, "0");
    str = `${intPart}.${paddedDec}`;
  }

  // Add thousand separators
  const [intPart, decPart] = str?.split(".") || [];
  let formatted = Number(intPart).toLocaleString(locale);
  if (decPart) formatted += `.${decPart}`;

  // Handle sign placement - if symbol is prefix, sign should come before symbol
  let sign = "";
  if (showSign && num > 0) sign = "+";
  if (num < 0) {
    sign = "-";
    formatted = formatted.replace("-", "");
  }

  if (mode === "percent") formatted += "%";

  if (symbol) {
    if (symbolPosition === "prefix") {
      // Sign comes before symbol: +$20.22 or -$20.22
      formatted = `${sign}${symbol}${formatted}`;
    } else {
      // Suffix: 20.22 $ or +20.22 $ or -20.22 $
      formatted = `${sign}${formatted} ${symbol}`;
    }
  } else {
    // No symbol, just add sign
    formatted = `${sign}${formatted}`;
  }

  return formatted.trim();
}

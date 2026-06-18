import { stripSymbolPrefix } from "./utils";

const formatSymbol = (symbol: string) => {
  let formatted = symbol;

  // Strip legacy venue prefixes (xyz:, flx:, vntl:, etc.)
  formatted = stripSymbolPrefix(formatted);

  if (formatted === "CL") {
    formatted = "OIL";
  }

  // Ticker mappings for specific symbols
  const tickerMap: Record<string, string> = {
    UFART: "FARTCOIN",
    UUSPX: "SPX6900",
    HPENGU: "PENGU",
    UXPL: "XPL",
    UPUMP: "PUMP",
    UMON: "MON",
    USDT0: "USDT",
    NTQ: "KNTQ",
    UENA: "ENA",
    XAUT0: "XAUT",
    UBONK: "BONK",
  };

  // Apply ticker mapping if exists
  if (tickerMap[formatted]) {
    formatted = tickerMap[formatted];
  }

  // Remove trailing "0" from tokens that end with 0, but not if it's part of a number (e.g., xyz100)
  if (formatted.endsWith("0") && !formatted.endsWith("00")) {
    formatted = formatted.slice(0, -1);
  }

  return formatted;
};

export default formatSymbol;

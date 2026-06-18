import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strip a legacy venue prefix from a symbol — e.g. "xyz:BTC" -> "BTC",
 * "flx:HYPE" -> "HYPE". Symbols without a "prefix:" pass through unchanged
 * (DeepBook keys like "SUI_DBUSDC" have no colon, so they're untouched).
 */
export function stripSymbolPrefix(symbol: string): string {
  const i = symbol.indexOf(":")
  return i >= 0 ? symbol.slice(i + 1) : symbol
}

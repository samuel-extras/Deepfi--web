import React from "react";
import {
  BitcoinIcon,
  EthereumIcon,
  SolanaIcon,
  TetherUSDIcon,
  USDCIcon,
} from "@/components/icons/token-icons";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import formatSymbol from "@/lib/formatSymbol";
// Local crypto images downloaded into /assets. `@/*` → repo root, and Next types
// png imports (next/image-types) so each yields a hashed StaticImageData url.
import suiImg from "@/assets/sui.png";
import usdcImg from "@/assets/usdc.png";
import usdtImg from "@/assets/usdt.png";
import deepImg from "@/assets/deep.png";
import walImg from "@/assets/wal.png";

/** Downloaded asset images, keyed by uppercase base symbol — these win over CDN. */
const LOCAL_IMAGES: Record<string, string> = {
  SUI: suiImg.src,
  USDC: usdcImg.src,
  "USDC.E": usdcImg.src,
  USDT: usdtImg.src,
  DEEP: deepImg.src,
  WAL: walImg.src,
};

interface TokenIconProps {
  symbol: string;
  size?: number;
  isSpot?: boolean;
  logoUrl?: string | null;
}

export const TokenIcon: React.FC<TokenIconProps> = ({
  symbol,
  size = 24,
  isSpot = false,
  logoUrl,
}) => {
  const base = (symbol?.split("/")[0] ?? symbol).toUpperCase();
  // Exact match, else any *USDC / *USDT variant reuses the stablecoin image.
  const localSrc =
    LOCAL_IMAGES[base] ??
    (base.endsWith("USDC")
      ? usdcImg.src
      : base.endsWith("USDT")
        ? usdtImg.src
        : undefined);

  // Crisp built-in vectors (no network) when there's no downloaded override.
  const iconMap: Record<string, React.ReactNode> = {
    BTC: <BitcoinIcon size={size} />,
    ETH: <EthereumIcon size={size} />,
    SOL: <SolanaIcon size={size} />,
    USDT: <TetherUSDIcon size={size} />,
    USDC: <USDCIcon size={size} />,
    "USDC.e": <USDCIcon size={size} />,
  };
  if (!localSrc && !logoUrl && iconMap[symbol]) {
    return <>{iconMap[symbol]}</>;
  }

  // Render every image (downloaded > explicit logo > DeepBook CDN) through the
  // shadcn Avatar — it handles load/error and falls back to a monogram for free.
  const src =
    localSrc ??
    logoUrl ??
    `https://app.deepbook.xyz/coins/${getImagePath(symbol, isSpot)}.svg`;

  return (
    <Avatar className="shrink-0" style={{ width: size, height: size }}>
      <AvatarImage src={src} alt={symbol} className="object-contain" />
      <AvatarFallback
        className="bg-[#1F1F1F] font-bold text-white"
        style={{ fontSize: Math.max(9, Math.round(size * 0.4)) }}
      >
        {formatSymbol(symbol).slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
};

const getImagePath = (symbol: string, isSpot: boolean): string => {
  // For spot tokens, append _spot suffix
  if (isSpot) {
    const baseSymbol = symbol?.split("/")?.[0]; // Handle "BTC/USDC" format
    return `${baseSymbol.toUpperCase()}_spot`;
  }

  // For prefixed tokens, keep the full symbol with prefix (e.g., "xyz:NVDA")
  if (symbol.includes(":")) {
    return symbol;
  }

  // Handle k-prefixed synthetic tokens (e.g., kBONK → BONK.svg)
  if (symbol.charAt(0) === "k" && symbol.length > 1) {
    return symbol.substring(1).toUpperCase();
  }

  // Return symbol as-is (failsafe)
  return symbol.toUpperCase();
};

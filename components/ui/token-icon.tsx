import React, { useState } from "react";
import {
  BitcoinIcon,
  EthereumIcon,
  SolanaIcon,
  TetherUSDIcon,
  USDCIcon,
} from "@/components/icons/token-icons";
import formatSymbol from "@/lib/formatSymbol";

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
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const formattedSymbol = formatSymbol(symbol);

  // If a custom logo URL is provided, try it first
  if (logoUrl) {
    return <ExternalLogoIcon url={logoUrl} symbol={symbol} size={size} />;
  }

  const iconMap: Record<string, React.ReactNode> = {
    BTC: <BitcoinIcon size={size} />,
    ETH: <EthereumIcon size={size} />,
    SOL: <SolanaIcon size={size} />,
    USDT: <TetherUSDIcon size={size} />,
    USDC: <USDCIcon size={size} />,
    "USDC.e": <USDCIcon size={size} />,
  };

  if (iconMap[symbol]) {
    return <>{iconMap[symbol]}</>;
  }

  const imgLogo = getImagePath(symbol, isSpot);
  const imgSrc = `https://app.deepbook.xyz/coins/${imgLogo}.svg`;

  return (
    <>
      {(!imgLoaded || imgError) && (
        <TokenMonogram symbol={formattedSymbol} size={size} />
      )}

      {!imgError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          width={size}
          height={size}
          alt={symbol}
          className="rounded-full"
          style={{ display: imgLoaded ? "block" : "none" }}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
        />
      )}
    </>
  );
};

const ExternalLogoIcon: React.FC<{
  url: string;
  symbol: string;
  size: number;
}> = ({ url, symbol, size }) => {
  const [error, setError] = useState(false);
  const formattedSymbol = formatSymbol(symbol);

  if (error) {
    return <TokenMonogram symbol={formattedSymbol} size={size} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      width={size}
      height={size}
      alt={symbol}
      className="rounded-full"
      onError={() => setError(true)}
    />
  );
};

const TokenMonogram: React.FC<{ symbol: string; size: number }> = ({
  symbol,
  size,
}) => {
  const sizeClass =
    size === 24 ? "w-6 h-6" : size === 32 ? "w-8 h-8" : "w-12 h-12";
  const textClass =
    size === 24 ? "text-[10px]" : size === 32 ? "text-xs" : "text-sm";

  return (
    <div
      className={`${sizeClass} rounded-full bg-[#1F1F1F] flex items-center justify-center border border-border`}
    >
      <span className={`text-white ${textClass} font-bold`}>
        {symbol.slice(0, 2).toUpperCase()}
      </span>
    </div>
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

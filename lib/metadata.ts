import type { Metadata } from "next";
import formatSymbol from "@/lib/formatSymbol";
import { stripSymbolPrefix } from "@/lib/utils";
import {
  DEFAULT_SYMBOL,
  MARKET_TYPES,
  normalizeSymbol,
  parseTradeRouteParams,
} from "./utils/urlParsing";

const siteName = "DEX";
const defaultTitle = "DEX – Seamless Perpetual Trading with Deep Liquidity";
const defaultDescription =
  "Experience next-level crypto trading on DEX. Access deep liquidity, lightning-fast execution, and fully transparent pricing for perpetual contracts.";
const defaultKeywords = [
  "crypto trading",
  "perpetual contracts",
  "DEX",
  "futures trading",
  "on-chain trading",
  "fast execution",
  "transparent pricing",
];

const defaultImages = [
  {
    url: "/og-default.png",
    width: 1200,
    height: 630,
    alt: defaultTitle,
  },
];

export const baseMetadata: Metadata = {
  title: defaultTitle,
  description: defaultDescription,
  keywords: defaultKeywords,
  applicationName: siteName,
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    siteName,
    type: "website",
    locale: "en_US",
    images: defaultImages,
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: defaultImages.map(image => image.url),
  },
  icons: {
    icon: "/dex.svg",
    shortcut: "/dex.svg",
    apple: "/dex.svg",
  },
};

export function withDefaultMetadata(
  overrides: Partial<Metadata> = {}
): Metadata {
  const title = overrides.title ?? baseMetadata.title;
  const description = overrides.description ?? baseMetadata.description;
  const og = overrides.openGraph ?? {};
  const tw = overrides.twitter ?? {};
  const ogTitle = (og.title ?? title) || undefined;
  const ogDescription = (og.description ?? description) || undefined;
  const twTitle = (tw.title ?? title) || undefined;
  const twDescription = (tw.description ?? description) || undefined;

  return {
    ...baseMetadata,
    ...overrides,
    title,
    description,
    keywords: overrides.keywords ?? baseMetadata.keywords,
    icons: overrides.icons ?? baseMetadata.icons,
    openGraph: {
      ...baseMetadata.openGraph,
      ...og,
      title: ogTitle,
      description: ogDescription,
      images: og.images ?? baseMetadata.openGraph?.images,
      siteName: og.siteName ?? siteName,
    },
    twitter: {
      ...baseMetadata.twitter,
      ...tw,
      title: twTitle,
      description: twDescription,
      images: tw.images ?? baseMetadata.twitter?.images,
    },
  };
}

function buildTitle({
  priceText,
  base,
  quote,
  isSpot,
}: {
  priceText?: string;
  base: string;
  quote?: string;
  isSpot: boolean;
}) {
  const symbolPart = isSpot && quote ? `${base}/${quote}` : base;
  return priceText
    ? `${priceText} | ${symbolPart} | ${siteName}`
    : `${symbolPart} | ${siteName}`;
}

export async function buildTradeMetadata({
  params,
}: {
  params?: string[];
}): Promise<Metadata> {
  const { symbol: rawSymbol, marketType } = parseTradeRouteParams(params);
  const normalizedSymbol = normalizeSymbol(rawSymbol || DEFAULT_SYMBOL);
  const formattedBase = formatSymbol(stripSymbolPrefix(normalizedSymbol));
  const rawQuote = params?.[1];
  const preferredQuote = normalizeSymbol(rawQuote || "USDC");
  const formattedQuote = formatSymbol(preferredQuote);

  // Keep metadata generation synchronous and deterministic.
  // Fetching mark prices here can block route responses and delay navigation.
  const title = buildTitle({
    base: formattedBase,
    quote: marketType === MARKET_TYPES.SPOT ? formattedQuote : undefined,
    isSpot: marketType === MARKET_TYPES.SPOT,
  });

  const description = `Trade ${formattedBase} on DEX with live depth, mark prices, and fast execution.`;

  return withDefaultMetadata({
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  });
}

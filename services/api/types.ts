export enum EventType {
  DAILY_ACTIVE = "daily_active",
  TRADE_COMPLETED = "trade_completed",
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  TRANSFER = "transfer",
  SEND = "send",
}

export enum TradeMarketType {
  SPOT = "spot",
  PERP = "perp",
}

export interface TradeMetadata {
  externalTradeId?: string;
  symbol: string;
  side: "buy" | "sell";
  amount: string | number;
  feePaid: string | number;
  builderFee: string | number;
  executedAt?: Date | string;
  marketType?: TradeMarketType;
}

export function getDeviceLabel(): string {
  if (typeof window === "undefined") return "unknown";

  const ua = navigator.userAgent;
  const maxLength = 100;

  let deviceLabel = "";

  if (/Mobile|Android|iPhone|iPad/.test(ua)) {
    if (/iPhone/.test(ua)) {
      deviceLabel = "iPhone";
    } else if (/iPad/.test(ua)) {
      deviceLabel = "iPad";
    } else if (/Android/.test(ua)) {
      deviceLabel = "Android";
    } else {
      deviceLabel = "Mobile";
    }
  } else {
    if (/Windows/.test(ua)) {
      deviceLabel = "Windows";
    } else if (/Mac/.test(ua)) {
      deviceLabel = "Mac";
    } else if (/Linux/.test(ua)) {
      deviceLabel = "Linux";
    } else {
      deviceLabel = "Desktop";
    }
  }

  return deviceLabel.slice(0, maxLength);
}

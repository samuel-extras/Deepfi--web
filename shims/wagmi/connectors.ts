// Shim for `wagmi/connectors` — stub connector factories (no real EVM wallets).
/* eslint-disable @typescript-eslint/no-explicit-any */

const makeConnector = (id: string, name: string) => () =>
  ({ id, name, type: "injected" }) as any;

export const injected = makeConnector("injected", "Injected");
export const coinbaseWallet = makeConnector("coinbaseWallet", "Coinbase Wallet");
export const metaMask = makeConnector("metaMask", "MetaMask");
export const safe = makeConnector("safe", "Safe");
export const walletConnect = makeConnector("walletConnect", "WalletConnect");

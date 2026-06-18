// import { createConfig } from "@privy-io/wagmi";
// import { http } from "viem";
import { mainnet, arbitrum, polygon, sepolia } from "wagmi/chains";
import { coinbaseWallet, injected, metaMask, safe } from "wagmi/connectors";

import { createConfig } from "wagmi";
import { http } from "wagmi";

export const wagmiConfig = createConfig({
  ssr: false,
  chains: [mainnet, sepolia, arbitrum, polygon],
  connectors: [injected(), coinbaseWallet(), metaMask(), safe()],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
  },
});

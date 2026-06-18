"use client";

import { PrivyProvider as Privy } from "@privy-io/react-auth";
import { arbitrum, mainnet, polygon } from "viem/chains";

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  return (
    <Privy
      appId={
        process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmbf0n7if01otl80m61qikr23"
      }
      clientId={
        process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ||
        "client-WY6MA3GjKkAUNu4wuAzuF67T7GMoxHWaiUZGDQ6NY6kbC"
      }
      config={{
        defaultChain: arbitrum,
        supportedChains: [arbitrum, mainnet, polygon],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          // showWalletUIs: false,
        },
      }}
    >
      {children}
    </Privy>
  );
}

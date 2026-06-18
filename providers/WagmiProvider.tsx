"use client";

import type { ReactNode } from "react";
import { WagmiProvider as Wagmi } from "wagmi";
import { wagmiConfig } from "./wagmiConfig";

export function WagmiProvider({ children }: { children: ReactNode }) {
  return <Wagmi config={wagmiConfig}>{children}</Wagmi>;
}

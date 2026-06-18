"use client";

import { type ReactNode } from "react";
import { WagmiProvider } from "./WagmiProvider";
import { InitProvider } from "./InitProvider";
import { QueryProvider } from "./queryProvider";
import { SuiProvider } from "./SuiProvider";

const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <WagmiProvider>
        <QueryProvider>
          <SuiProvider>
            <InitProvider>{children}</InitProvider>
          </SuiProvider>
        </QueryProvider>
    </WagmiProvider>
  );
};

export default Providers;

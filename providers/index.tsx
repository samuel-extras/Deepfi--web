"use client";

import { type ReactNode } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { WagmiProvider } from "./WagmiProvider";
import { InitProvider } from "./InitProvider";
import { QueryProvider } from "./queryProvider";
import { SuiProvider } from "./SuiProvider";
import { OracleLiveStream } from "./OracleLiveStream";

const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <WagmiProvider>
        <QueryProvider>
          <OracleLiveStream />
          <SuiProvider>
            <NuqsAdapter>
              <InitProvider>{children}</InitProvider>
            </NuqsAdapter>
          </SuiProvider>
        </QueryProvider>
    </WagmiProvider>
  );
};

export default Providers;

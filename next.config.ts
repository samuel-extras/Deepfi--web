import type { NextConfig } from "next";
import path from "node:path";

// During the DEXV2 -> DeepFi (Sui) migration we replaced Privy + Wagmi (EVM)
// with local mock shims (see shims/). The bundler needs these aliases so the
// (uninstalled) `wagmi` / `@privy-io/*` bare imports resolve to the shims.
const r = (p: string) => path.resolve(__dirname, p);

const SHIM_ALIASES: Record<string, string> = {
  wagmi: r("shims/wagmi/index.tsx"),
  "wagmi/chains": r("shims/wagmi/chains.ts"),
  "wagmi/connectors": r("shims/wagmi/connectors.ts"),
  "@privy-io/react-auth": r("shims/privy/react-auth.tsx"),
  "@privy-io/wagmi": r("shims/privy/wagmi.ts"),
  // some wallet/Sui deps reference react-native; stub them out for web.
  "react-native": r("shims/empty-module.ts"),
  "@react-native-async-storage/async-storage": r("shims/empty-module.ts"),
};

const nextConfig: NextConfig = {
  // Lets a second dev server (preview/verification) run beside the main one
  // without fighting over .next. Defaults to the normal dist dir.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Shim types are reconciled — `tsc --noEmit` is clean, so let the build
  // type-check too (catches regressions the dev server's transpile-only path
  // would miss).
  typescript: { ignoreBuildErrors: false },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  turbopack: {
    resolveAlias: {
      wagmi: "./shims/wagmi/index.tsx",
      "wagmi/chains": "./shims/wagmi/chains.ts",
      "wagmi/connectors": "./shims/wagmi/connectors.ts",
      "@privy-io/react-auth": "./shims/privy/react-auth.tsx",
      "@privy-io/wagmi": "./shims/privy/wagmi.ts",
      "react-native": "./shims/empty-module.ts",
      "@react-native-async-storage/async-storage": "./shims/empty-module.ts",
    },
  },
  webpack: config => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      ...Object.fromEntries(
        Object.entries(SHIM_ALIASES).map(([k, v]) => [`${k}$`, v])
      ),
    };
    return config;
  },
};

export default nextConfig;

/**
 * Shared DeepBook V3 core — network config, pool/coin metadata, the client
 * factory, order-encoding helpers, formatting, and the Move-abort humanizer.
 * Consumed by the spot and margin trading surfaces alike.
 *
 * Import this barrel for the pure/config layer:
 *   import { getSpotPool, formatAmount } from "@/lib/deepbook/core";
 *
 * The heavier layers live on their own subpaths so a module that just needs a
 * formatter doesn't drag in React or the network:
 *   - domain logic:   @/lib/deepbook/domain/*
 *   - REST + reads:   @/lib/deepbook/api/*
 *   - on-chain hooks: @/lib/deepbook/hooks/*
 *
 * NOTE: this barrel is `core.ts`, not `index.ts`, on purpose. A legacy
 * `lib/deepbook.ts` (Predict/combo contract constants) still shadows the bare
 * `@/lib/deepbook` specifier, so always import from `@/lib/deepbook/core` (or a
 * subpath). Renaming that legacy file to free the namespace is tracked as
 * follow-up tech debt.
 */
export * from "./config";
export * from "./pools";
export * from "./client";
export * from "./orders";
export * from "./format";
export * from "./errors";

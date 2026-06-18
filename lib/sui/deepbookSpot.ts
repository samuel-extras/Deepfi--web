/**
 * @deprecated Canonical home is now `@/lib/deepbook/core` (plus its `domain/`,
 * `api/`, and `hooks/` subpaths). This module is kept as a thin re-export shim
 * so existing spot/margin/prediction imports keep resolving while call sites
 * migrate. New code should import from `@/lib/deepbook/core` directly.
 */
export * from "@/lib/deepbook/core";

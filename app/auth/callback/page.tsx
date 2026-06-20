"use client";

/**
 * OAuth callback — Google redirects here with the id_token in the URL fragment
 * (`#id_token=…`), which only client JS can read. We complete the zkLogin flow
 * (salt → proof → session) and return to the app; SuiAuthBridge then reflects
 * the zkLogin address everywhere.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useZkLoginStore } from "@/stores/useZkLoginStore";

export default function ZkLoginCallbackPage() {
  const router = useRouter();
  const complete = useZkLoginStore((s) => s.complete);
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void (async () => {
      const frag = new URLSearchParams(window.location.hash.slice(1));
      const idToken = frag.get("id_token");
      if (!idToken) {
        setError(frag.get("error") ?? "No id_token returned from Google");
        return;
      }
      // Mobile relay: deepfi-mobile signs in through THIS web OAuth client (same
      // `aud` → same zkLogin address) and uses this page as its redirect_uri.
      // When `state` is the app's scheme, bounce the id_token back into the app;
      // it derives salt (our /api/zklogin/salt) + proof itself. Only the known
      // app scheme is allowed here — never an arbitrary URL (no open redirect).
      const ret = frag.get("state") ?? "";
      if (ret.startsWith("deepfimobile://")) {
        window.location.replace(
          `deepfimobile://auth#id_token=${encodeURIComponent(idToken)}`,
        );
        return;
      }
      try {
        await complete(idToken);
        router.replace("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [complete, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {error ? (
          <>
            <p className="text-sm font-semibold text-destructive">
              Sign-in failed
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
            <button
              onClick={() => router.replace("/")}
              className="mt-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
            >
              Back to app
            </button>
          </>
        ) : (
          <>
            <span className="size-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">
              Verifying your sign-in…
            </p>
          </>
        )}
      </div>
    </div>
  );
}

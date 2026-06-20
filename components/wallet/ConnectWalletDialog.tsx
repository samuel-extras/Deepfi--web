"use client";

/**
 * Branded connect dialog — replaces dapp-kit's generic ConnectModal. Leads with
 * "Continue with Google" (raw Sui zkLogin, gasless) and lists any installed Sui
 * wallets below as a secondary option.
 */
import * as React from "react";
import { useConnectWallet, useWallets } from "@mysten/dapp-kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useZkLoginStore } from "@/stores/useZkLoginStore";
import { zkProviderEnabled } from "@/lib/zklogin/config";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

export function ConnectWalletDialog({
  trigger,
  open: openProp,
  onOpenChange,
}: {
  /** Optional trigger element (desktop). Omit when controlling externally. */
  trigger?: React.ReactNode;
  /** Controlled open state (e.g. from the mobile nav). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const wallets = useWallets();
  const { mutate: connect, isPending } = useConnectWallet();
  const login = useZkLoginStore((s) => s.login);
  const status = useZkLoginStore((s) => s.status);
  const error = useZkLoginStore((s) => s.error);

  const googleEnabled = zkProviderEnabled("google");

  const handleGoogle = () => {
    void login("google"); // redirects to Google (or sets `error` if unconfigured)
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Sign in to deepfi</DialogTitle>
          <DialogDescription>
            Trade gasless — no wallet extension or SUI required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            type="button"
            onClick={handleGoogle}
            disabled={!googleEnabled || status === "authenticating"}
            className="h-11 w-full justify-center gap-2 rounded-full bg-white text-sm font-semibold text-[#0E0E0E] hover:bg-white/90"
          >
            <GoogleGlyph />
            {status === "authenticating"
              ? "Redirecting…"
              : "Continue with Google"}
          </Button>

          {!googleEnabled ? (
            <p className="text-center text-[11px] text-muted-foreground">
              Google sign-in isn’t configured yet (NEXT_PUBLIC_GOOGLE_CLIENT_ID).
            </p>
          ) : null}
          {error ? (
            <p className="text-center text-[11px] text-destructive">{error}</p>
          ) : null}

          {wallets.length > 0 ? (
            <>
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground">
                  or connect a wallet
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {wallets.map((wallet) => (
                  <Button
                    key={wallet.name}
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      connect(
                        { wallet },
                        { onSuccess: () => setOpen(false) },
                      )
                    }
                    className="h-11 w-full justify-start gap-3 rounded-xl"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={wallet.icon} alt="" className="size-5 rounded" />
                    <span className="text-sm font-medium">{wallet.name}</span>
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <p className="mt-1 text-center text-[10px] text-muted-foreground">
          Gasless · sponsored on testnet · not financial advice
        </p>
      </DialogContent>
    </Dialog>
  );
}

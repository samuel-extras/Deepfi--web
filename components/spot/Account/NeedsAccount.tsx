"use client";

/** Connect-wallet / create-trading-account prompt shown when an account action
 *  needs a signer + BalanceManager. Renders nothing once both exist. */
import { ConnectWalletDialog } from "@/components/wallet/ConnectWalletDialog";
import { Button } from "@/components/ui/button";
import { useBalanceManager, useDeepBookAddress } from "@/lib/deepbook/hooks/account";

export default function NeedsAccount({ label }: { label: string }) {
  const address = useDeepBookAddress();
  const { managerId, create, isCreating } = useBalanceManager();
  if (address && managerId) return null;
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8">
      <p className="text-xs text-nav-inactive">{label}</p>
      {!address ? (
        <ConnectWalletDialog
          trigger={
            <Button type="button" size="sm" className="rounded-full bg-primary text-[#121417] font-semibold">
              Connect wallet
            </Button>
          }
        />
      ) : (
        <Button
          type="button"
          size="sm"
          disabled={isCreating}
          onClick={() => create()}
          className="rounded-full bg-primary text-[#121417] font-semibold"
        >
          {isCreating ? "Creating…" : "Create trading account"}
        </Button>
      )}
    </div>
  );
}

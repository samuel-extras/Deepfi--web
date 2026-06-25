"use client";

/**
 * Withdraw dUSDC from the connected wallet's PredictManager back to the wallet.
 * Used by the portfolio "Transfer Funds" / cash-out flow to move settled
 * winnings (the manager's trading balance) on-chain to the user's address.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useCallback, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { useSignAndExecuteTransaction } from "@/lib/zklogin/useSponsoredExecute";
import { useRefreshAfterTx } from "@/hooks/useRefreshAfterTx";
import { toast } from "sonner";
import { buildWithdrawFromManagerTx } from "@/lib/ptb/predict";
import { waitForTxSuccess } from "@/lib/sui/txStatus";

export function usePredictWithdraw() {
  const account = useActiveAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const refreshAfterTx = useRefreshAfterTx();
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const withdraw = useCallback(
    async (args: { managerId: string; amountDusdc: number }) => {
      if (!account?.address) {
        toast.error("Connect your wallet to withdraw");
        return;
      }
      if (!args.managerId) {
        toast.error("No Predict account found");
        return;
      }
      if (!(args.amountDusdc > 0)) {
        toast.error("Enter an amount greater than 0");
        return;
      }
      setIsWithdrawing(true);
      try {
        const tx = buildWithdrawFromManagerTx({
          managerId: args.managerId,
          amountDusdc: args.amountDusdc,
          recipient: account.address,
        });
        const res = await signAndExecute({ transaction: tx });
        await waitForTxSuccess(client, res.digest);
        toast.success(
          `Withdrew $${args.amountDusdc.toFixed(2)} · ${res.digest.slice(0, 8)}…`,
        );
        refreshAfterTx();
        return res.digest;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Withdraw failed: ${msg.slice(0, 160)}`);
      } finally {
        setIsWithdrawing(false);
      }
    },
    [account?.address, client, signAndExecute, refreshAfterTx],
  );

  return { withdraw, isWithdrawing, isConnected: Boolean(account?.address) };
}

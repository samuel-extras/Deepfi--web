"use client";

/**
 * Redeem settled / live DeepBook Predict positions and ranges.
 * Dispatches the correct PTB (redeem_range vs redeem) based on position type.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useCallback, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { useSignAndExecuteTransaction } from "@/lib/zklogin/useSponsoredExecute";
import { toast } from "sonner";
import { buildRedeemRangeTx, buildRedeemBinaryTx } from "@/lib/ptb/predict";
import { fromDusdcU64 } from "@/lib/deepbook";

export type RedeemRangeArgs = {
  kind: "range";
  managerId: string;
  oracleId: string;
  expiryMs: number;
  lowerUsd: number;
  higherUsd: number;
  quantity: number | string;
};

export type RedeemBinaryArgs = {
  kind: "binary";
  managerId: string;
  oracleId: string;
  expiryMs: number;
  strikeUsd: number;
  isUp: boolean;
  quantity: number | string;
};

export type RedeemArgs = RedeemRangeArgs | RedeemBinaryArgs;

export function usePredictRedeem() {
  const account = useActiveAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const redeem = useCallback(
    async (a: RedeemArgs) => {
      if (!account?.address) {
        toast.error("Connect your wallet to redeem");
        return;
      }
      setIsRedeeming(true);
      try {
        setStatus("Building redeem…");
        let tx;
        if (a.kind === "range") {
          tx = buildRedeemRangeTx({
            managerId: a.managerId,
            leg: {
              oracleId: a.oracleId,
              expiryMs: a.expiryMs,
              lowerStrikeUsd: a.lowerUsd,
              higherStrikeUsd: a.higherUsd,
              quantity: a.quantity,
            },
          });
        } else {
          tx = buildRedeemBinaryTx({
            managerId: a.managerId,
            oracleId: a.oracleId,
            expiryMs: a.expiryMs,
            strikeUsd: a.strikeUsd,
            isUp: a.isUp,
            quantity: a.quantity,
          });
        }

        setStatus("Awaiting signature…");
        const res = await signAndExecute({ transaction: tx });
        await client.waitForTransaction({ digest: res.digest });
        toast.success(`Redeemed · ${res.digest.slice(0, 8)}…`);
        return res.digest;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Redeem failed: ${msg.slice(0, 160)}`);
      } finally {
        setIsRedeeming(false);
        setStatus(null);
      }
    },
    [account?.address, client, signAndExecute],
  );

  return { redeem, isRedeeming, status, isConnected: Boolean(account?.address) };
}

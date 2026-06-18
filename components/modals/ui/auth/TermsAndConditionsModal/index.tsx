"use client";

import { Button } from "@/components/ui/button";
import { ModalRenderProps } from "@/components/modals/model/types";
import { useAuthStore } from "@/stores/useAuthStore";
import { LogoIcon, PoweredByPrivyIcon } from "@/components/icons";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useLoginWithSiwe, useWallets, usePrivy } from "@privy-io/react-auth";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useModalControls } from "@/components/modals/hooks/useModalControls";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import { useUserProfileStore } from "@/stores/useUserProfileStore";

type Props = ModalRenderProps<"termsAndConditions">;

const TermsAndConditionsModal = ({ onClose }: Props) => {
  const { hydrateFromPrivyUser, logout: logoutStore } = useAuthStore();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { wallets } = useWallets();
  const { logout: logoutPrivy } = usePrivy();
  const resetUserProfile = useUserProfileStore(state => state.reset);
  const searchParams = useSearchParams();
  const { generateSiweMessage, loginWithSiwe, state } = useLoginWithSiwe({
    onComplete: async ({ user }) => {
      hydrateFromPrivyUser(user);

      const privyId = user?.id || "";
      const email = user?.email?.address;

      const walletAddress = user?.wallet?.address || address || "";

      if (privyId && walletAddress) {
        let referralCode: string | undefined;
        try {
          referralCode = searchParams?.get("referralCode") || undefined;
        } catch {
          referralCode = undefined;
        }

        dexBackendApi.authenticate({
          privyId,
          walletAddress,
          email,
          ...(referralCode && { referralCode }),
        });
      }

      onClose();
    },
    onError: error => {
      console.error("SIWE authentication error:", error);
      setError("Authentication failed. Please try again.");
    },
  });

  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useModalControls(
    {
      closeOnBackdropClick: false,
      showCloseButton: false,
    },
    [state.status, isProcessing]
  );

  useEffect(() => {
    if (!isConnected || !address) {
      onClose();
    }
  }, [isConnected, address, onClose]);

  const handleDecline = async () => {
    // Capture token before clearing store
    const token = useAuthStore.getState().jwtToken;
    // Logout from backend API (non-blocking) - pass token explicitly
    dexBackendApi.logout(token);
    resetUserProfile();
    logoutPrivy();
    logoutStore();
    disconnect();
    onClose();
  };

  const handleAccept = async () => {
    if (!address) {
      setError("No wallet address found. Please connect your wallet.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const message = await generateSiweMessage({
        address,
        chainId: "eip155:42161", // Arbitrum, must be CAIP-2 format per Privy docs
      });

      const privyWallet = wallets.find(
        (w: { address?: string }) =>
          w.address?.toLowerCase() === address.toLowerCase()
      );

      let signature: string;
      if (privyWallet) {
        signature = await privyWallet.sign(message);
      } else {
        signature = await signMessageAsync({ message });
      }

      await loginWithSiwe({ message, signature });
    } catch (err) {
      console.error("SIWE error:", err);
      setError("Authentication failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusText = () => {
    switch (state.status) {
      case "generating-message":
        return "Generating authentication message...";
      case "awaiting-signature":
        return "Please sign the message in your wallet...";
      case "submitting-signature":
        return "Confirming authentication...";
      case "error":
        return "Authentication failed. Please try again.";
      default:
        return "";
    }
  };

  const isSigning =
    state.status === "awaiting-signature" ||
    state.status === "submitting-signature";
  const isGenerating = state.status === "generating-message";
  const hasError = state.status === "error" || error;

  return (
    <div className="w-full lg:max-w-md mx-auto">
      <div className="flex flex-col gap-4 justify-center items-center mb-6">
        <LogoIcon />
        <h1 className="font-semibold text-lg text-white text-center">
          Terms & Conditions
        </h1>
      </div>

      <div className="mb-6">
        <div className="bg-[#121417] border border-[#2D3134] rounded-lg p-4 max-h-60 overflow-y-auto">
          <h3 className="font-semibold text-sm text-white mb-3">
            Terms of Service
          </h3>
          <div className="text-xs text-[#A9A9A9] space-y-2">
            <p>
              By using this decentralized exchange (DEX), you agree to the
              following terms:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                You are responsible for the security of your wallet and private
                keys
              </li>
              <li>All transactions are irreversible and conducted on-chain</li>
              <li>
                You understand the risks associated with decentralized trading
              </li>
              <li>
                You are of legal age in your jurisdiction to use this service
              </li>
              <li>You will not use this service for illegal activities</li>
            </ul>
            <p className="mt-3">
              By clicking &quot;Accept &amp; Sign In&quot;, you acknowledge that
              you have read, understood, and agree to be bound by these terms.
            </p>
          </div>
        </div>
      </div>

      {(isGenerating || isSigning || hasError) && (
        <div className="mb-4">
          <div
            className={`text-sm text-center ${
              hasError ? "text-red-400" : "text-[#A9A9A9]"
            }`}
          >
            {hasError ? error || "Authentication failed" : getStatusText()}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Button
          onClick={handleDecline}
          variant="outline"
          className="w-full font-semibold text-xs text-white border-[#2D3134] bg-transparent lg:hover:bg-[#2D3134]/20 hover:border-[#3A3E42] rounded-[25px] transition-all duration-200"
        >
          Decline
        </Button>
        <Button
          onClick={handleAccept}
          disabled={isProcessing || !isConnected}
          className="w-full font-semibold text-xs text-[#1F1F1F] bg-white lg:hover:bg-white/90 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-[25px] transition-all duration-200"
        >
          {isProcessing ? "Processing..." : "Accept"}
        </Button>
      </div>

      <div className="flex justify-center">
        <PoweredByPrivyIcon />
      </div>
    </div>
  );
};

export default TermsAndConditionsModal;

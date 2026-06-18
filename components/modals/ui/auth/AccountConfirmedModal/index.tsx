"use client";

import { useEffect } from "react";
import { ModalRenderProps } from "@/components/modals/model/types";
import { useAuthStore } from "@/stores/useAuthStore";
import { LogoIcon, PoweredByPrivyIcon } from "@/components/icons";
import AuthLoadingAnimation from "../AuthLoadingAnimation";

type Props = ModalRenderProps<"accountConfirmed">;

const AccountConfirmedModal = ({
  accountType,
  accountInfo,
  isVerified = false,
  loading = false,
  onClose,
}: Props) => {
  const { loginWithEmail, loginWithWallet } = useAuthStore();

  // Effective verification depends on loading state
  const verified = !loading && isVerified;

  useEffect(() => {
    if (verified) {
      // Update auth store immediately
      if (accountType === "email") {
        loginWithEmail(accountInfo);
      } else {
        const walletAddress = "0x1234...5678"; // In real app, this would come from wallet connection
        loginWithWallet("walletconnect", walletAddress);
      }

      // Auto-close after 1 second since verification was already done
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  }, [
    accountType,
    accountInfo,
    verified,
    loginWithEmail,
    loginWithWallet,
    onClose,
  ]);

  return (
    <div className="w-full lg:w-[250px]">
      <div className="flex flex-col gap-4 justify-center items-center mb-3">
        <LogoIcon />

        <h1 className="font-semibold text-base text-white">
          {verified ? "Account Confirmed" : "Confirming..."}
        </h1>
      </div>

      <div className="flex justify-center items-center mt-4">
        <AuthLoadingAnimation status={verified ? "success" : "loading"} />
      </div>

      <div className="flex justify-center mt-6">
        <PoweredByPrivyIcon />
      </div>
    </div>
  );
};

export default AccountConfirmedModal;

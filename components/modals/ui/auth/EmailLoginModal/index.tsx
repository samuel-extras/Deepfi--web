"use client";

import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { useSearchParams } from "next/navigation";
import EmailStep from "./EmailStep";
import OTPStep from "./OTPStep";
import LoadingConfirmation from "./LoadingConfirmation";
import { LogoIcon, PoweredByPrivyIcon } from "@/components/icons";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  useLoginWithEmail,
  useCreateWallet,
  usePrivy,
} from "@privy-io/react-auth";
import { useModalStore } from "@/components/modals/model/useModalStore";
import { useModalControls } from "@/components/modals/hooks/useModalControls";
import { dexBackendApi } from "@/services/api/dexBackendApi";

type Step = "email" | "otp" | "loadingConfirmation";

const EmailLoginModal = () => {
  const walletCreatedRef = useRef(false);
  const { hydrateFromPrivyUser, setEmbeddedWallet } = useAuthStore();
  const { closeModal } = useModalStore();
  const { createWallet } = useCreateWallet();
  const { ready, authenticated, user } = usePrivy();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [otpError, setOtpError] = useState<string | undefined>(undefined);

  const {
    sendCode,
    loginWithCode,
    state: emailAuthState,
  } = useLoginWithEmail({
    onComplete: async ({ user }) => {
      hydrateFromPrivyUser(user);
      await createEmbeddedWallet(user);

      const privyId = user?.id || "";
      const email = user?.email?.address;

      const walletAddress =
        user?.wallet?.address ||
        (Array.isArray(user?.linkedAccounts)
          ? (
              user.linkedAccounts.find(
                acc => acc?.type === "wallet" && "address" in acc && acc.address
              ) as { address: string } | undefined
            )?.address
          : undefined) ||
        "";

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
    },
    onError: error => {
      const message =
        typeof error === "string" ? error : "Login failed. Please try again.";
      if (step === "email") {
        setEmailError(message);
      } else {
        setOtpError(message);
      }
    },
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailSubmit = async () => {
    setEmailError(undefined);
    setOtpError(undefined);
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    try {
      await sendCode({ email });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to send code";
      setEmailError(message);
    }
  };

  const handleOTPSubmit = async () => {
    try {
      await loginWithCode({ code: otp });
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Invalid code. Please try again.";
      setOtpError(message);
      setOtp("");
    }
  };

  const handleResendCode = async () => {
    try {
      await sendCode({ email });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to resend code";
      setOtpError(message);
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setOtp("");
  };

  const createEmbeddedWallet = useCallback(
    async (
      user: {
        wallet?: { address?: string } | null;
        linkedAccounts?: Array<{ type?: string } | null> | null;
      } | null
    ) => {
      if (!user || walletCreatedRef.current) return;

      const hasWallet =
        !!user?.wallet?.address ||
        (Array.isArray(user?.linkedAccounts)
          ? user!.linkedAccounts!.some(acc => acc?.type === "wallet")
          : false);

      if (hasWallet) return;

      try {
        console.log("Creating embedded wallet...");
        const wallet = await createWallet();
        if (wallet?.address) {
          setEmbeddedWallet(wallet.address);
          walletCreatedRef.current = true;
          console.log("Embedded wallet successfully created:", wallet);
        }
      } catch (err) {
        console.error("Embedded wallet creation failed", err);
      }
    },
    [createWallet, setEmbeddedWallet]
  );

  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    createEmbeddedWallet(user);
  }, [ready, authenticated, user, createEmbeddedWallet]);

  useEffect(() => {
    const status = emailAuthState.status;
    const loading = status === "sending-code" || status === "submitting-code";

    startTransition(() => {
      setIsLoading(loading);

      if (status === "awaiting-code-input") {
        setStep("otp");
      }
      if (status === "submitting-code") {
        setStep("loadingConfirmation");
      }

      if (status === "error" && emailAuthState.error) {
        const message =
          typeof emailAuthState.error === "string"
            ? emailAuthState.error
            : "An error occurred";

        if (step === "email") {
          setEmailError(message);
        } else {
          setOtpError(message);
        }
      }
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (step === "loadingConfirmation" && status === "done") {
      timeoutId = setTimeout(() => {
        closeModal();
      }, 2000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [emailAuthState, step, closeModal]);

  // Disable backdrop click while on OTP or loading confirmation step to prevent accidental dismissal
  useModalControls(
    {
      closeOnBackdropClick:
        step === "otp" || step === "loadingConfirmation" ? false : true,
    },
    [step]
  );

  const stepComponents = {
    email: (
      <EmailStep
        email={email}
        setEmail={setEmail}
        isLoading={isLoading}
        onSubmit={handleEmailSubmit}
        errorMessage={emailError}
      />
    ),
    otp: (
      <OTPStep
        email={email}
        otp={otp}
        setOtp={setOtp}
        onVerify={handleOTPSubmit}
        onBackToEmail={handleBackToEmail}
        onResendCode={handleResendCode}
        isLoading={isLoading}
        errorMessage={otpError}
      />
    ),
    loadingConfirmation: (
      <LoadingConfirmation isDone={emailAuthState.status === "done"} />
    ),
  };

  const containerWidth =
    step === "loadingConfirmation" ? "w-[250px]" : "w-[350px]";

  return (
    <div className={`w-full lg:${containerWidth} mx-auto`}>
      <div className="flex justify-center items-center mb-3">
        <LogoIcon />
      </div>

      {stepComponents[step]}

      <div className="flex justify-center mt-6">
        <PoweredByPrivyIcon />
      </div>
    </div>
  );
};

export default EmailLoginModal;

"use client";

import {
  CoinbaseWalletIcon,
  EmailIcon,
  LogoIcon,
  MetamaskWalletIcon,
  OKXWalletIcon,
  PoweredByPrivyIcon,
  WalletConnectIcon,
} from "@/components/icons";
import { ModalRenderProps } from "@/components/modals/model/types";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { useModalStore } from "@/components/modals/model/useModalStore";
import { ReactNode, useEffect, useState } from "react";
import { useConnect, useAccount } from "wagmi";
import { useAuthStore } from "@/stores/useAuthStore";
import { useIsMobile } from "@/hooks/useIsMobile";

type Props = ModalRenderProps<"connectAccount">;

interface WalletOption {
  id: string;
  name: string;
  icon: ReactNode;
  variant: "primary" | "secondary";
  onClick: () => void;
}

const ConnectAccountModal = ({ onClose }: Props) => {
  const { openModal } = useModalStore();
  const { setUserInfo } = useAuthStore();
  const { connect, connectors } = useConnect();
  const { isConnected, address, connector } = useAccount();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isConnected && address && connector) {
      const connectorName = connector.name.toLowerCase();
      let connectorType: "injected" | "walletconnect" | "coinbase" | null =
        null;

      if (connectorName.includes("walletconnect")) {
        connectorType = "walletconnect";
      } else if (connectorName.includes("coinbase")) {
        connectorType = "coinbase";
      } else if (
        connectorName.includes("injected") ||
        connectorName.includes("metamask") ||
        connectorName.includes("okx")
      ) {
        connectorType = "injected";
      }

      setUserInfo({
        walletAddress: address,
        connectorType: connectorType,
      });

      setIsConnecting(false);

      onClose();
      openModal("termsAndConditions", {});
    }
  }, [isConnected, address, connector, onClose, openModal, setUserInfo]);

  const handleEmailLogin = () => {
    onClose();
    openModal("emailLogin", {});
  };

  const getConnector = (
    name: "MetaMask" | "Coinbase" | "WalletConnect" | "OKX"
  ) =>
    connectors.find((c: { name: string }) =>
      c.name.toLowerCase().includes(name.toLowerCase())
    );

  const handleWalletConnect = async (
    connector: "MetaMask" | "Coinbase" | "WalletConnect" | "OKX"
  ) => {
    const targetConnector = getConnector(connector);
    if (!targetConnector) {
      setConnectionError("Wallet connector not found");
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      await connect({ connector: targetConnector });
    } catch (error) {
      console.error("Wallet connection error:", error);
      setConnectionError("Failed to connect wallet. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const allWalletOptions: WalletOption[] = [
    {
      id: "metamask",
      name: "MetaMask",
      icon: <MetamaskWalletIcon />,
      variant: "secondary",
      onClick: () => handleWalletConnect("MetaMask"),
    },
    {
      id: "walletconnect",
      name: "WalletConnect",
      icon: <WalletConnectIcon />,
      variant: "secondary",
      onClick: () => handleWalletConnect("WalletConnect"),
    },
    {
      id: "okx",
      name: "OKX Wallet",
      icon: <OKXWalletIcon />,
      variant: "secondary",
      onClick: () => handleWalletConnect("OKX"),
    },
    {
      id: "coinbase",
      name: "Coinbase Wallet",
      icon: <CoinbaseWalletIcon />,
      variant: "secondary",
      onClick: () => handleWalletConnect("Coinbase"),
    },
  ];

  // On mobile, only show WalletConnect
  const walletOptions = isMobile
    ? allWalletOptions.filter(option => option.id === "walletconnect")
    : allWalletOptions;

  return (
    <div className="w-full lg:max-w-md mx-auto">
      <div className="flex flex-col gap-4 justify-center items-center">
        <LogoIcon />
        <h1 className="font-semibold text-lg text-white text-center">
          Connect to DEX
        </h1>
      </div>

      <div className="mt-6">
        <Button
          size="lg"
          className="w-full font-semibold text-xs text-[#1F1F1F] bg-white lg:hover:bg-white/90 rounded-[25px] transition-all duration-200 justify-center"
          onClick={handleEmailLogin}
          variant="default"
          type="button"
        >
          <EmailIcon />
          Login with Email
        </Button>
      </div>

      <div className="flex gap-3 justify-center items-center my-4">
        <Divider />
        <span className="font-medium text-sm text-[#A9A9A9] text-center px-2">
          or
        </span>
        <Divider />
      </div>

      <div className="space-y-3 mb-8">
        {walletOptions.map(option => (
          <WalletConnectionButton
            key={option.id}
            option={option}
            disabled={isConnecting}
          />
        ))}
      </div>

      <div className="flex justify-center">
        <PoweredByPrivyIcon />
      </div>
    </div>
  );
};

export default ConnectAccountModal;

const WalletConnectionButton = ({
  option,
  disabled = false,
}: {
  option: WalletOption;
  disabled?: boolean;
}) => {
  const baseClasses =
    "w-full font-semibold text-xs rounded-[25px] transition-all duration-200";

  const variantClasses = {
    primary: "text-[#1F1F1F] bg-white lg:hover:bg-white/90 border-0",
    secondary:
      "text-white border border-[#2D3134] bg-transparent lg:hover:bg-[#2D3134]/20 hover:border-[#3A3E42]",
  };

  return (
    <Button
      size="lg"
      className={`${baseClasses} ${variantClasses[option.variant]} ${
        option.variant === "secondary" ? "justify-start" : "justify-center"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={option.onClick}
      variant="default"
      type="button"
      disabled={disabled}
    >
      {option.icon}
      {option.name}
    </Button>
  );
};

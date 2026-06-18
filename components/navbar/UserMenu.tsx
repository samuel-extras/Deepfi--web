"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Copy, Check } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

type UserMenuProps = {
  email?: string;
  walletAddress?: string;
  onLogout: () => void;
};

const formatAddress = (addr?: string) => {
  if (!addr) return "—";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const UserMenu: React.FC<UserMenuProps> = ({
  email,
  walletAddress,
  onLogout,
}) => {
  const [open, setOpen] = React.useState(false);
  const { copied, copyToClipboard } = useCopyToClipboard({ duration: 1000 });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          className="font-semibold border border-[#2D3134] text-xs text-white rounded-[25px] hover:cursor-pointer bg-transparent lg:hover:bg-transparent gap-2 w-[9.5rem] overflow-hidden truncate"
          type="button"
        >
          <span className="truncate">
            {formatAddress(walletAddress) || email}
          </span>
          <ChevronDown
            className={`transition-transform duration-200 ${
              open ? "rotate-180" : "rotate-0"
            }`}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[11rem] bg-[#121417] border-border rounded-[10px] p-2"
      >
        {email && (
          <p className="text-xs font-normal text-[#A9A9A9] truncate max-w-[10rem]">
            {email}
          </p>
        )}

        <div className="flex items-center gap-2">
          <span className="font-medium text-white text-xs">
            {formatAddress(walletAddress)}
          </span>
          <button
            type="button"
            aria-label="Copy wallet address"
            className="inline-flex h-6 w-6 items-center justify-center rounded lg:hover:bg-white/10 hover:cursor-pointer"
            onClick={() => {
              if (!walletAddress) return;
              void copyToClipboard(walletAddress);
            }}
            title={copied ? "Copied" : "Copy"}
          >
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4 text-primary" />
            )}
          </button>
        </div>
        <DropdownMenuSeparator className="bg-border" />
        <button
          type="button"
          className="hover:cursor-pointer w-full h-full text-left font-normal text-[#FF4D4F] text-xs"
          onClick={onLogout}
        >
          Logout
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;

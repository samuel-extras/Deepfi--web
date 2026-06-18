"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ModalBaseProps {
  children: React.ReactNode;
  onClose: () => void;
  show: boolean;
  closeOnBackdropClick?: boolean;
  showCloseButton?: boolean;
}

export default function ModalBase({
  children,
  onClose,
  show,
  closeOnBackdropClick = true,
  showCloseButton = true,
}: ModalBaseProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      {/* Modal backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-xs"
        onClick={closeOnBackdropClick ? onClose : undefined}
      />

      {/* Modal content */}
      <div
        className={cn(
          "relative z-10 w-full lg:w-fit p-5 bg-[#1A1D1F] rounded-t-3xl lg:rounded-3xl",
          !showCloseButton && "pt-7"
        )}
      >
        {showCloseButton && (
          <Button
            className="flex justify-center items-center w-[35px] h-[35px] bg-transparent lg:hover:bg-[#1A1D1F]/20 border border-border rounded-full ml-auto"
            onClick={onClose}
          >
            <X className="w-4 h-4 text-white" />
          </Button>
        )}

        {children}
      </div>
    </div>
  );
}

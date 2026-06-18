"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useModalControls } from "@/components/modals/hooks/useModalControls";
import type { ModalRenderProps } from "../../model/types";

export default function ConfirmActionModal({
  header,
  subheader,
  buttonText,
  onConfirm,
  onClose,
}: ModalRenderProps<"confirmAction">) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalControls(
    {
      beforeClose: () => !isProcessing,
    },
    [isProcessing]
  );
  const handleConfirm = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      await Promise.resolve(onConfirm());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full lg:min-w-[400px]">
      <h2 className="text-center text-base font-semibold mb-4">{header}</h2>
      {subheader && (
        <p className="text-center text-sm text-muted-foreground mb-6">
          {subheader}
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive mb-4 text-center">{error}</p>
      )}

      <div className="flex justify-center mt-6">
        <Button
          size="lg"
          className={`font-semibold text-xs rounded-[25px] transition-all duration-200`}
          onClick={handleConfirm}
          type="button"
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : buttonText}
        </Button>
      </div>
    </div>
  );
}

import { useCallback, useState } from "react";

type UseCopyToClipboardOptions = {
  /**
   * How long (in ms) the `copied` state should remain true.
   * @default 1200
   */
  duration?: number;
  /**
   * Optional callback invoked after a successful copy.
   */
  onCopySuccess?: (value: string) => void | Promise<void>;
  /**
   * Optional callback invoked when copying fails.
   */
  onCopyError?: (error: unknown, value: string) => void | Promise<void>;
};

export const useCopyToClipboard = ({
  duration = 1200,
  onCopySuccess,
  onCopyError,
}: UseCopyToClipboardOptions = {}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value || "");
        setCopied(true);

        if (onCopySuccess) {
          await onCopySuccess(value);
        }

        window.setTimeout(() => setCopied(false), duration);
      } catch (error) {
        if (onCopyError) {
          await onCopyError(error, value);
        }
      }
    },
    [duration, onCopyError, onCopySuccess]
  );

  return {
    copied,
    copyToClipboard,
  };
};

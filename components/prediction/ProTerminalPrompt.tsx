"use client";

/**
 * One-time "try the pro terminal?" prompt on the prediction page. Shows once
 * ever (persisted via proPromptSeen), only when the user is still on the classic
 * markets list, and only after a 10s delay so the cards are loaded and visible
 * first. Accepting flips predictionProView → the page swaps to the pro terminal.
 *
 * Self-gating: renders nothing unless it should ask, so it's safe to always
 * mount on the prediction page.
 */
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppSettingsStore } from "@/stores/useAppSettingsStore";

const DELAY_MS = 10_000;

export function ProTerminalPrompt() {
  const proView = useAppSettingsStore((s) => s.predictionProView);
  const seen = useAppSettingsStore((s) => s.proPromptSeen);
  const updateSetting = useAppSettingsStore((s) => s.updateSetting);
  const [open, setOpen] = useState(false);

  // Ask only if they're on the classic view and haven't been prompted before.
  const shouldAsk = !proView && !seen;

  useEffect(() => {
    if (!shouldAsk) return;
    const id = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(id);
  }, [shouldAsk]);

  if (!shouldAsk) return null;

  // Any close (button, Esc, overlay) records that we've asked; accepting also
  // switches the default view to the pro terminal.
  const finish = (toPro: boolean) => {
    if (toPro) updateSetting("predictionProView", true);
    updateSetting("proPromptSeen", true);
    setOpen(false);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) finish(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Try the Pro Terminal?</AlertDialogTitle>
          <AlertDialogDescription>
            There&apos;s a pro trading terminal for predictions — the BTC chart,
            strike ladder, order ticket, and your positions all on one screen.
            Make it your default prediction view? You can switch back anytime
            from Settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>
            Keep classic
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => finish(true)}>
            Use Pro Terminal
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

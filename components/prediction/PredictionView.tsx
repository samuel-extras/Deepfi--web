"use client";

/**
 * Prediction page view switch. Renders the classic markets list by default, or
 * the margin-style pro terminal when the navbar "Pro Prediction Terminal"
 * setting is on. The choice persists in app settings.
 */
import dynamic from "next/dynamic";
import { usePredictionProView } from "@/stores/useAppSettingsStore";
import PredictionList from "@/components/prediction/Predictions";
import { ProTerminalPrompt } from "@/components/prediction/ProTerminalPrompt";

const PredictProTerminal = dynamic(
  () => import("@/components/prediction/terminal/PredictProTerminal"),
  { ssr: false },
);

export default function PredictionView() {
  const proView = usePredictionProView();
  return (
    <>
      {proView ? <PredictProTerminal /> : <PredictionList />}
      {/* One-time prompt to adopt the pro terminal (self-gates; classic only). */}
      <ProTerminalPrompt />
    </>
  );
}

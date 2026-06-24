import SurfaceStudio from "@/components/prediction/surface/SurfaceStudio";

export const metadata = {
  title: "Vol Surface Studio — Deepcast",
  description:
    "The live DeepBook Predict SVI volatility surface — IV by strike × expiry, with butterfly/calendar no-arbitrage checks.",
};

export default function SurfacePage() {
  return <SurfaceStudio />;
}

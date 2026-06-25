import PredictionView from "@/components/prediction/PredictionView";

// DeepBook Predict — markets listing (the prediction home). The view (classic
// list vs pro terminal) is chosen by the navbar setting; see PredictionView.
export const metadata = {
  title: "Prediction Markets",
  description:
    "Live DeepBook Predict oracles — binary BTC price markets priced off the on-chain vol surface.",
};

export default function PredictionPage() {
  return <PredictionView />;
}

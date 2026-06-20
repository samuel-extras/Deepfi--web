import PredictionList from "@/components/prediction/Predictions";

// DeepBook Predict — markets listing (the prediction home).
export const metadata = {
  title: "Prediction Markets",
  description:
    "Live DeepBook Predict oracles — binary BTC price markets priced off the on-chain vol surface.",
};

export default function PredictionPage() {
  return <PredictionList />;
}

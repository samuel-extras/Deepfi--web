import ComboTrade from "@/components/prediction/ComboTrade";

export const metadata = {
  title: "Combo Trade — DeepFi",
  description:
    "Execute a three-protocol atomic PTB spanning DeepBook Margin, DeepBook Predict, and the PLP vault.",
};

export default function ComboTradePage() {
  return <ComboTrade />;
}

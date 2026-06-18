import RiskDashboard from "@/components/prediction/risk/RiskDashboard";

export const metadata = {
  title: "PLP Risk Dashboard — DeepFi",
  description:
    "Is PLP safe? Live DeepBook Predict vault health, per-oracle exposure, and a ±σ BTC stress test against the vault's payout liability.",
};

export default function RiskPage() {
  return <RiskDashboard />;
}

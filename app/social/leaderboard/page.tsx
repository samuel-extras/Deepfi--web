import { redirect } from "next/navigation";

// The legacy DEX-backend leaderboard is replaced by the on-chain IV-Edge board.
export default function SocialLeaderboardPage() {
  redirect("/prediction/top-traders");
}

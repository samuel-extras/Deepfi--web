import { redirect } from "next/navigation";

// Followings depended on the off-chain DEX backend; consolidated into the live feed.
export default function SocialFollowingsPage() {
  redirect("/social");
}

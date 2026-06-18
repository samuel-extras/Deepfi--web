"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function CompetitionDetailBackNav() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/competition")}
      className="w-8 h-8 rounded-full bg-[#1A1D1F] lg:hover:bg-[#1a1d21] border border-border flex justify-center items-center gap-2 text-nav-inactive cursor-pointer lg:hover:text-white transition-colors mb-6"
      aria-label="Back to competitions"
    >
      <ChevronLeft className="w-4 h-4" />
    </button>
  );
}

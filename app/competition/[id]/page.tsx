import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { CompetitionDetailPageSkeleton } from "@/components/ui/RouteStreamingFallbacks";
import { getCompetitionDetailCached } from "@/lib/competition/getCompetitionDetail";
import { withDefaultMetadata } from "@/lib/metadata";

const CompetitionDetailView = dynamic(
  () => import("@/components/competition/CompetitionDetailView"),
  { loading: () => <CompetitionDetailPageSkeleton /> }
);

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCompetitionDetailCached(id);

  if (!detail) {
    return withDefaultMetadata({
      title: "Competition | DEX",
      description: "View trading competitions on DEX.",
    });
  }

  const title = `${detail.name} | DEX`;
  const description =
    detail.description?.slice(0, 160) ||
    "Competition details and leaderboard on DEX.";

  return withDefaultMetadata({
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  });
}

export default async function CompetitionPage({ params }: PageProps) {
  const { id } = await params;
  return <CompetitionDetailView competitionId={id} />;
}

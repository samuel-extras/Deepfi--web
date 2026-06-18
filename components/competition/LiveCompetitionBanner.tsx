"use client";
import { useMemo } from "react";
import {
  FirstPlaceBadgeIcon,
  SecondPlaceBadgeIcon,
  ThirdPlaceBadgeIcon,
  PeopleIcon,
} from "@/components/icons";
import { Clock } from "lucide-react";
import Image from "next/image";
import { useLatestCompetition } from "@/hooks/useLatestCompetition";
const calculateTimeRemaining = (targetDate: string): string => {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return "";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}mins`);

  return parts.join(" ") || "0mins";
};

export function LiveCompetitionBanner() {
  const { data, isLoading } = useLatestCompetition();

  const competitionData = useMemo(() => {
    if (!data) return null;

    const timeInfo = calculateTimeRemaining(data.endDate);
    const topPrizes =
      data.prizeDistributions
        ?.sort((a, b) => a.place - b.place)
        .slice(0, 3)
        .map(dist => {
          const prizeAmount = data.prizePool
            ? (parseFloat(data.prizePool) * dist.percentage) / 100
            : 0;
          return {
            place: dist.place,
            amount: `$${prizeAmount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
          };
        }) || [];

    return {
      timeInfo,
      participants: data._count?.participants,
      topPrizes,
    };
  }, [data]);

  if (isLoading || !data) {
    return null;
  }

  return (
    <div
      className="w-full rounded-2xl p-4 lg:p-6 flex items-center relative"
      style={{
        background:
          "linear-gradient(132.76deg, #FFFFFF 9.12%, #FFFFFF 20.11%, #C6C6C6 30.98%, #FFFFFF 50.4%, #C6C6C6 76.74%, #FFFFFF 96.57%), #212326",
        backgroundBlendMode: "multiply",
        boxShadow: "0px 15px 20px 0px #00000040",
      }}
    >
      <div className="space-y-4 w-full lg:w-auto">
        <div className="px-2 py-1 lg:px-4 lg:py-2 rounded-full bg-primary/15 flex items-center gap-x-2 w-fit">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <p className="text-xs text-primary font-semibold">
            {data.status} Competition
          </p>
        </div>

        <p className="text-xl font-semibold text-white">{data.name}</p>

        <div className="flex gap-x-10 items-end lg:items-center justify-between lg:justify-start">
          <div className="space-y-1">
            <p className="text-xs text-nav-inactive font-normal">Prize Pool</p>
            <p className="text-primary font-semibold text-xl">
              {data.prizePool}
            </p>
          </div>

          <div className="space-y-2 flex flex-col-reverse lg:flex-col justify-end items-end lg:justify-start lg:items-start">
            <div className="flex gap-x-2 items-center">
              <Clock className="w-4 h-4" />
              <p className="text-xs text-nav-inactive font-normal">
                Ends in{" "}
                <span className="text-white font-medium">
                  {competitionData?.timeInfo}
                </span>
              </p>
            </div>

            <div className="flex gap-x-2 items-center">
              <PeopleIcon className="w-4 h-4" />
              <p className="text-xs text-white font-medium">
                {competitionData?.participants?.toLocaleString()}
              </p>
            </div>
          </div>

          {competitionData?.topPrizes &&
            competitionData.topPrizes.length > 0 && (
              <div className="hidden lg:flex gap-x-6">
                {competitionData.topPrizes.map(prize => {
                  const BadgeIcon =
                    prize.place === 1
                      ? FirstPlaceBadgeIcon
                      : prize.place === 2
                        ? SecondPlaceBadgeIcon
                        : ThirdPlaceBadgeIcon;
                  const placeLabel =
                    prize.place === 1
                      ? "1st Place"
                      : prize.place === 2
                        ? "2nd Place"
                        : "3rd Place";

                  return (
                    <div
                      key={prize.place}
                      className="flex gap-x-2 items-center"
                    >
                      <BadgeIcon />
                      <div className="space-y-1">
                        <p className="text-xs text-nav-inactive font-normal">
                          {placeLabel}
                        </p>
                        <p className="text-white font-semibold text-sm">
                          {prize.amount}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      <div className="absolute top-3 right-3 lg:relative lg:top-auto lg:right-auto lg:flex-1 lg:flex lg:justify-end lg:pr-6">
        <Image
          src="/competion-cup.png"
          alt="Competition Cup"
          width={120}
          height={105}
          draggable={false}
          onContextMenu={event => event.preventDefault()}
          priority
          className="select-none pointer-events-none w-[82px] h-[72px] lg:w-[120px] lg:h-[105px]"
        />
      </div>
    </div>
  );
}

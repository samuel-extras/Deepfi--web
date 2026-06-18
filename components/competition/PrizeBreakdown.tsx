import {
  FirstPlaceBadgeIcon,
  SecondPlaceBadgeIcon,
  ThirdPlaceBadgeIcon,
} from "@/components/icons";
import type { Prize } from "./constants";

interface PrizeBreakdownProps {
  prizes: Prize[];
}

const RANK_CONFIG = {
  1: {
    icon: <FirstPlaceBadgeIcon />,
    gradient:
      "linear-gradient(186.45deg, #D0841A 25.88%, #FFC683 60.24%, #D0841A 94.6%)",
    color: "#D0841A",
  },
  2: {
    icon: <SecondPlaceBadgeIcon />,
    gradient:
      "linear-gradient(186.45deg, #919191 25.88%, #FFEDD7 60.24%, #787878 94.6%)",
    color: "#787878",
  },
  3: {
    icon: <ThirdPlaceBadgeIcon />,
    gradient:
      "linear-gradient(186.45deg, #623900 25.88%, #B56A00 57.27%, #623900 94.6%)",
    color: "#623900",
  },
} as const;

const getRankConfig = (rank?: number) => {
  if (!rank || !(rank in RANK_CONFIG)) return null;
  return RANK_CONFIG[rank as keyof typeof RANK_CONFIG];
};

export const PrizeBreakdown = ({ prizes }: PrizeBreakdownProps) => {
  return (
    <div className="space-y-3">
      {prizes.map((prize, index) => {
        const config = getRankConfig(prize.rank);

        return (
          <div
            key={index}
            className="flex items-center justify-between p-4 rounded-2xl"
            style={{
              background:
                "linear-gradient(132.76deg, #FFFFFF 9.12%, #FFFFFF 20.11%, #C6C6C6 30.98%, #FFFFFF 50.4%, #C6C6C6 76.74%, #FFFFFF 96.57%), #212326",
              backgroundBlendMode: "multiply",
              borderBottom: config?.color
                ? `3px solid ${config.color}`
                : "none",
            }}
          >
            <div className="flex items-center gap-3">
              {config?.icon && (
                <div className="flex-shrink-0">{config.icon}</div>
              )}
              <p className="text-sm text-white font-semibold">{prize.place}</p>
            </div>
            <div className="text-right">
              <p className="text-white font-semibold text-lg">{prize.amount}</p>
              {prize.percentage && (
                <p className="text-xs text-nav-inactive">{prize.percentage}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

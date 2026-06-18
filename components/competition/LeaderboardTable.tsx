import {
  FirstPlaceBadgeIcon,
  SecondPlaceBadgeIcon,
  ThirdPlaceBadgeIcon,
} from "@/components/icons";
import type { LeaderboardEntry } from "./constants";

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
}

export const LeaderboardTable = ({ data }: LeaderboardTableProps) => {
  return (
    <div className="border border-border rounded-2xl p-4">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-xs text-nav-inactive font-normal pb-3">
                Rank
              </th>
              <th className="text-left text-xs text-nav-inactive font-normal pb-3">
                Trader
              </th>
              <th className="text-right text-xs text-nav-inactive font-normal pb-3">
                Trading Volume
              </th>
              <th className="text-right text-xs text-nav-inactive font-normal pb-3">
                Trades
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={index}
                className="border-0 hover:bg-white/5 transition-colors"
              >
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    {row.rank <= 3 ? (
                      <div className="w-6 h-6 flex items-center justify-center">
                        {row.rank === 1 && <FirstPlaceBadgeIcon />}
                        {row.rank === 2 && <SecondPlaceBadgeIcon />}
                        {row.rank === 3 && <ThirdPlaceBadgeIcon />}
                      </div>
                    ) : (
                      <span
                        className="text-xs text-nav-inactive w-6 h-6 rounded-b-sm text-center font-medium flex items-center justify-center"
                        style={{
                          background:
                            "linear-gradient(0deg, #1A1D1F, #1A1D1F), linear-gradient(0deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.05))",
                        }}
                      >
                        {row.rank}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3">
                  <span className="text-sm text-white font-normal">
                    {row.trader}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <span className="text-sm text-nav-inactive">
                    {row.tradingVolume}
                  </span>
                </td>
                <td className="py-3 text-right text-nav-inactive">
                  <span className="text-sm text-white">{row.trades}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

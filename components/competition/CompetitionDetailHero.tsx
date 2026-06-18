import { STATUS_CONFIG, type Competition } from "./constants";

interface CompetitionDetailHeroProps {
  competition: Competition;
}

export default function CompetitionDetailHero({
  competition,
}: CompetitionDetailHeroProps) {
  const config = STATUS_CONFIG[competition.status];

  return (
    <div className="mb-6">
      <h1 className="text-xl text-white font-semibold">{competition.title}</h1>
      <p className="text-sm text-nav-inactive font-normal mt-1">
        {competition.description}
      </p>

      <div
        className={`px-2 py-1 lg:px-4 lg:py-2 rounded-full ${config.bgColor} flex items-center gap-x-2 w-fit my-4`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
        <p className={`text-xs ${config.textColor} font-semibold`}>
          {config.label}
        </p>
      </div>
    </div>
  );
}

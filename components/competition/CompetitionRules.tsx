interface CompetitionRulesProps {
  description: string;
  rules: string[];
}

export const CompetitionRules = ({
  description,
  rules,
}: CompetitionRulesProps) => {
  return (
    <div className="space-y-4">
      <p className="text-sm text-nav-inactive leading-relaxed mb-4">
        {description}
      </p>
      <ul className="space-y-3">
        {rules.map((rule, index) => (
          <li key={index} className="flex gap-3">
            <span className="text-primary mt-1 text-sm">•</span>
            <span className="text-sm text-nav-inactive">{rule}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

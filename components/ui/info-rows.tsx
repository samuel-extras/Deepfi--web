"use client";

type Row = { label: string; value: string };

export default function InfoRows({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-2 text-sm">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center justify-between text-xs text-nav-inactive"
        >
          <span>{r.label}</span>
          <span className="text-white">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

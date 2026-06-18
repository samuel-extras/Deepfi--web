export function PageIntroFallback() {
  return (
    <div className="space-y-2">
      <div className="h-7 w-40 animate-pulse rounded-md bg-muted/25" />
      <div className="h-4 w-72 animate-pulse rounded-md bg-muted/15" />
    </div>
  );
}


/** Competition detail: back control + title block + stat cards while RSC/query suspends. */
export function CompetitionDetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-8 animate-pulse rounded-full bg-muted/20" />
      <PageIntroFallback />
      <div className="h-8 w-28 animate-pulse rounded-full bg-muted/15" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:w-10/12">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-border/40 bg-muted/10"
          />
        ))}
      </div>
      <TableFallback rows={6} />
    </div>
  );
}

/** `/portfolio` — summary + chart + distribution + tables (matches portfolio layout). */
export function PortfolioPageSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6 lg:max-w-[87.5%] mx-auto w-full">
      <div className="flex flex-col gap-4 lg:flex-row">
        <PanelFallback className="h-64 w-full lg:w-[40%]" />
        <PanelFallback className="h-64 min-h-64 flex-1" />
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex w-full flex-col gap-4 lg:w-[40%]">
          <PanelFallback className="h-36" />
          <PanelFallback className="h-56" />
        </div>
        <TableFallback rows={6} className="min-h-64 flex-1" />
      </div>
      <TableFallback rows={5} />
    </div>
  );
}

/** `/prediction/portfolio` — header + chart strip + list. */
export function PredictionPortfolioPageSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6 lg:max-w-[87.5%] mx-auto w-full">
      <PageIntroFallback />
      <div className="flex flex-col gap-4 lg:flex-row">
        <PanelFallback className="h-44 flex-1" />
        <PanelFallback className="h-56 flex-[2]" />
      </div>
      <div className="h-10 max-w-md animate-pulse rounded-full bg-muted/15" />
      <TableFallback rows={8} />
    </div>
  );
}

/** `/prediction/top-traders` — filters + leaderboard table. */
export function TopTradersPageSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6 lg:max-w-[87.5%] mx-auto w-full">
      <PageIntroFallback />
      <div className="h-10 max-w-sm animate-pulse rounded-md bg-muted/15" />
      <TableFallback rows={12} />
    </div>
  );
}

/** `/wallet-export` — Privy gate + actions. */
export function WalletExportPageSkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-10">
      <PanelFallback className="h-36" />
      <PanelFallback className="h-28" />
    </div>
  );
}

/** `/social/followings` and `/social/leaderboard` while client chunk loads. */
export function SocialSubpageSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6 mx-auto w-full">
      <div className="h-7 w-48 animate-pulse rounded-md bg-muted/25" />
      <SidebarListFallback />
    </div>
  );
}

export function PanelFallback({ className = "h-48" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-border/40 bg-muted/10 ${className}`}
    />
  );
}

export function TableFallback({
  rows = 6,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border/40 bg-[#121417] p-4 ${className}`}
    >
      <div className="mb-4 h-10 w-full animate-pulse rounded-xl bg-white/5" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-12 animate-pulse rounded-xl bg-white/5"
          />
        ))}
      </div>
    </div>
  );
}

export function SidebarListFallback({
  items = 5,
  className = "",
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div
      className={`space-y-3 rounded-2xl border border-border/40 bg-[#121417] p-4 ${className}`}
    >
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

/** DeFi route: banner + desktop columns + account strip (matches `DefiPageClient` layout). */
export function DefiPageSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden">
      <div className="h-14 w-full animate-pulse bg-muted/15 border-b border-border/40" />
      <div className="hidden lg:flex flex-col">
        <div className="flex h-[82vh] max-h-[82vh] overflow-hidden">
          <div className="hidden min-[1400px]:block w-[320px] min-w-[280px] shrink-0 border-r border-border/40">
            <SidebarListFallback
              items={8}
              className="h-full rounded-none border-0 bg-[#121417]"
            />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex h-12 shrink-0 items-center gap-2 px-2">
              <div className="h-8 w-8 animate-pulse rounded-md bg-muted/20 min-[1400px]:hidden" />
              <div className="flex-1 h-8 animate-pulse rounded-md bg-muted/15" />
              <div className="h-8 w-8 animate-pulse rounded-md bg-muted/20 min-[1400px]:hidden" />
            </div>
            <PanelFallback className="flex-1 rounded-none border-0" />
          </div>
          <div className="hidden min-[1400px]:block w-[280px] min-w-60 shrink-0">
            <SidebarListFallback
              items={6}
              className="h-full rounded-none border-0 bg-[#121417]"
            />
          </div>
          <div className="w-1/5 min-w-[250px] shrink-0 border-l border-border/40">
            <PanelFallback className="h-full rounded-none border-0" />
          </div>
        </div>
        <TableFallback
          rows={4}
          className="rounded-none border-x-0 border-b-0"
        />
      </div>
      <div className="lg:hidden pb-20 space-y-3 px-4 pt-3">
        <div className="h-10 animate-pulse rounded-md bg-muted/15" />
        <PanelFallback className="h-72" />
        <TableFallback rows={3} />
      </div>
    </div>
  );
}

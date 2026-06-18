/* eslint-disable */
"use client";

// ---------------------------------------------------------------------------
// /prediction/ui-check — the dex events screen repointed at DeepBook Predict.
// Lists live oracles (one card per asset+expiry binary) from
// /api/prediction-markets. Category tabs are gone (DeepBook is crypto-only);
// search, status/volume filter, grid/list and favourites still run in-memory.
// ---------------------------------------------------------------------------

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  EventsFilter,
  FilterState,
} from "@/components/prediction/events/EventsFilter";
import { EventsHeader } from "@/components/prediction/events/EventsHeader";
import { SearchToolbar } from "@/components/prediction/events/SearchToolbar";
import EventsMarketsView from "@/components/prediction/events/EventsMarketsView";
import {
  marketsToEvents,
  groupIntoItems,
  type PredictEvent,
  type PredictMarketDTO,
  type MintActivity,
} from "../../lib/events";

const FAVORITES_KEY = "ui-check-favorites";

const formatCurrency = (val?: number) => {
  if (!val) return "$0";
  if (val >= 1000000000) return `$${(val / 1000000000).toFixed(2)}b`;
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}m`;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
  return `$${val.toFixed(2)}`;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

export default function EventsUiCheck() {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [booting, setBooting] = useState(true);
  const [events, setEvents] = useState<PredictEvent[]>([]);
  const [recentMints, setRecentMints] = useState<MintActivity[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<FilterState>({
    status: "active",
    minVolume: "",
    maxVolume: "",
    minLiquidity: "",
    maxLiquidity: "",
    sortBy: "endDate", // soonest expiry first → current market leads
    sortOrder: "asc",
    startDate: "",
    endDate: "",
  });

  // Load DeepBook prediction markets (oracles) from the indexer proxy.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/prediction-markets");
        const json: { ok: boolean; markets?: PredictMarketDTO[] } =
          await res.json();
        if (alive && json.ok && json.markets) {
          setEvents(marketsToEvents(json.markets));
        }
      } catch {
        // network/indexer error → fall through to the empty state
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Poll the recent-buys feed that drives the live "+$X" floats on series cards.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/prediction-activity");
        const json: { ok: boolean; mints?: MintActivity[] } = await res.json();
        if (alive && json.ok && json.mints) setRecentMints(json.mints);
      } catch {
        // ignore — floats just won't update this tick
      }
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Load favourites from localStorage (mirrors dex FavoritesService).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITES_KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);

  const toggleRow = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((f) => f !== id)
        : [...prev, id];
      try {
        window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetFilters = () => {
    setFilters({
      status: "active",
      sortOrder: "asc",
      sortBy: "endDate",
      minVolume: "",
      maxVolume: "",
      minLiquidity: "",
      maxLiquidity: "",
      startDate: "",
      endDate: "",
    });
    setSearchQuery("");
  };

  // Search → status → volume/liquidity → sort, all in-memory.
  const filteredEvents = useMemo(() => {
    let list: PredictEvent[] = [...events];

    // Search (live, by title)
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => e.title.toLowerCase().includes(q));
    }

    // Status
    if (filters.status === "active") {
      list = list.filter((e) => e.active && !e.closed);
    } else if (filters.status === "closed") {
      list = list.filter((e) => e.closed);
    }

    // Volume / liquidity bounds
    list = list.filter((e) => {
      const vol = e.volume || 0;
      const liq = e.liquidity || 0;
      if (filters.minVolume && vol < Number(filters.minVolume)) return false;
      if (filters.maxVolume && vol > Number(filters.maxVolume)) return false;
      if (filters.minLiquidity && liq < Number(filters.minLiquidity))
        return false;
      if (filters.maxLiquidity && liq > Number(filters.maxLiquidity))
        return false;
      return true;
    });

    // Sort: live markets first (soonest-to-settle leads — the "current" market),
    // then settling, then settled; the chosen key orders within each bucket.
    const nowMs = Date.now();
    const bucket = (e: PredictEvent) => {
      if (e.closed) return 2; // settled
      if (e.predict.expiry <= nowMs) return 1; // active but past expiry → settling
      return 0; // live
    };
    const dir = filters.sortOrder === "asc" ? 1 : -1;
    const key = (e: PredictEvent) => {
      switch (filters.sortBy) {
        case "liquidity":
          return e.liquidity || 0;
        case "startDate":
          return new Date(e.startDate || e.endDate || 0).getTime();
        case "endDate":
          return new Date(e.endDate || 0).getTime();
        default:
          return e.volume || 0;
      }
    };
    return [...list].sort((a, b) => {
      const bd = bucket(a) - bucket(b);
      return bd !== 0 ? bd : (key(a) - key(b)) * dir;
    });
  }, [events, searchQuery, filters]);

  // Collapse same-cadence rolling series (>3 markets) into one card.
  const items = useMemo(() => groupIntoItems(filteredEvents), [filteredEvents]);

  // The current market = soonest-to-settle live oracle (the first card).
  const currentId = useMemo(() => {
    const nowMs = Date.now();
    return (
      filteredEvents.find(
        (e) => e.active && !e.closed && e.predict.expiry > nowMs,
      )?.id ?? null
    );
  }, [filteredEvents]);

  const showInitialSkeleton = booting;
  const isRefreshingData = false;

  return (
    <div className="flex flex-col  ">
      <div className="container mx-auto max-w-360 w-full shrink-0 pt-4 md:pt-6 px-4 md:px-6 flex flex-col gap-4">
        <EventsHeader />

        <div className="flex items-center gap-2 justify-between sm:justify-end">
          <SearchToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClearSearch={() => setSearchQuery("")}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isFilterOpen={isFilterOpen}
            onFilterClick={() => setIsFilterOpen(true)}
            placeholder="Search markets…"
          />
          <EventsFilter filters={filters} setFilters={setFilters} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <EventsMarketsView
          viewMode={viewMode}
          showInitialSkeleton={showInitialSkeleton}
          isRefreshingData={isRefreshingData}
          filteredEvents={filteredEvents}
          items={items}
          recentMints={recentMints}
          currentId={currentId}
          favorites={favorites}
          expandedIds={expandedIds}
          fetchingMore={false}
          loadMoreRef={loadMoreRef}
          onToggleFavorite={handleToggleFavorite}
          onToggleExpand={toggleRow}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          onClearAll={resetFilters}
        />
      </div>
    </div>
  );
}

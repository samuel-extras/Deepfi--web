// Markets view for /prediction/ui-check — grid of cards (single + merged
// series) or a shadcn Table list. Repointed at the DeepBook data + components.
"use client";

import React from "react";
import { EventCard } from "./EventCard";
import { SeriesCard } from "./SeriesCard";
import { EventsEmptyState } from "./EventsEmptyState";
import { EventTableHeader } from "./EventTableHeader";
import { EventTableRow } from "./EventTableRow";
import { LoadingIndicator } from "./LoadingIndicator";
import { Table, TableBody } from "@/components/ui/table";
import { PredictEvent, MarketItem, MintActivity } from "@/lib/events";
import { EventCardSkeleton } from "./EventCardSkeleton";
import { EventListSkeleton } from "./EventListSkeleton";

export type EventsMarketsViewProps = {
  viewMode: "grid" | "list";
  showInitialSkeleton: boolean;
  isRefreshingData: boolean;
  filteredEvents: PredictEvent[];
  items: MarketItem[];
  recentMints: MintActivity[];
  currentId?: string | null;
  favorites: string[];
  expandedIds: Set<string>;
  fetchingMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onToggleExpand: (id: string) => void;
  formatCurrency: (value?: number) => string;
  formatDate: (value?: string) => string;
  onClearAll: () => void;
};

const GRID_COLS =
  "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export default function EventsMarketsView({
  viewMode,
  showInitialSkeleton,
  isRefreshingData,
  filteredEvents,
  items,
  recentMints,
  currentId,
  favorites,
  expandedIds,
  fetchingMore,
  loadMoreRef,
  onToggleFavorite,
  onToggleExpand,
  formatCurrency,
  formatDate,
  onClearAll,
}: EventsMarketsViewProps) {
  return (
    <div className="container mx-auto flex min-h-0 max-w-[1600px] scroll-smooth flex-col gap-6 px-4 pb-8 md:px-6">
      {showInitialSkeleton ? (
        viewMode === "grid" ? (
          <div className={`${GRID_COLS} pt-4`}>
            {Array.from({ length: 12 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border">
            <Table>
              <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <EventListSkeleton key={i} />
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : filteredEvents.length > 0 ? (
        <div className="flex flex-col gap-6 pt-4">
          <LoadingIndicator isVisible={isRefreshingData} />
          {viewMode === "grid" ? (
            <div className={GRID_COLS}>
              {items.map((item, idx) =>
                item.kind === "series" ? (
                  <SeriesCard
                    key={`series-${item.id}-${idx}`}
                    asset={item.asset}
                    intervalLabel={item.intervalLabel}
                    count={item.count}
                    current={item.current}
                    oracleIds={item.members.map((m) => m.predict.oracleId)}
                    recentMints={recentMints}
                    isFavorite={favorites.includes(item.current.id)}
                    onToggleFavorite={onToggleFavorite}
                  />
                ) : (
                  <EventCard
                    key={`${item.event.id}-${idx}`}
                    event={item.event}
                    isCurrent={item.event.id === currentId}
                    isFavorite={favorites.includes(item.event.id)}
                    onToggleFavorite={onToggleFavorite}
                  />
                ),
              )}
            </div>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <EventTableHeader />
                <TableBody>
                  {filteredEvents.map((event, idx) => (
                    <EventTableRow
                      key={`${event.id}-${idx}`}
                      event={event}
                      isCurrent={event.id === currentId}
                      isExpanded={expandedIds.has(event.id)}
                      isFavorite={favorites.includes(event.id)}
                      onToggleExpand={() => onToggleExpand(event.id)}
                      onToggleFavorite={(e) => onToggleFavorite(event.id, e)}
                      formatCurrency={formatCurrency}
                      formatDate={formatDate}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div ref={loadMoreRef}>
            <LoadingIndicator isVisible={fetchingMore} />
          </div>
        </div>
      ) : (
        <div className="pt-20">
          <EventsEmptyState onClearFilters={onClearAll} />
        </div>
      )}
    </div>
  );
}

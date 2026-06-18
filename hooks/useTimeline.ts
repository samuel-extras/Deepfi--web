"use client";

import { useQuery } from "@tanstack/react-query";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import { TimelineResponse } from "@/types/social";
import { useMemo } from "react";

export const useTimeline = (
  ready: boolean,
  postFilter: string,
  sizeFilter: string,
  openingFilter: string
) => {
  const following = postFilter === "Only Friends" ? true : false;
  const status =
    openingFilter === "Opening"
      ? "open"
      : openingFilter === "Closed"
        ? "close"
        : "all";
  const sizes =
    sizeFilter === "All Sizes"
      ? "all"
      : sizeFilter === "Min. size"
        ? "min"
        : "max";
  const query = useMemo(() => {
    // return query params as an string
    return `sizes=${sizes}${following ? "&onlyFollowed=true" : ""}${status === "all" ? "" : "&" + "status=" + status}`;
  }, [status, sizes, following]);
  return useQuery({
    queryKey: ["social", "timeline", query],
    queryFn: async () => {
      const timeline = await dexBackendApi.getTimeline(query);
      return timeline as TimelineResponse;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
    enabled: !!ready,
  });
};

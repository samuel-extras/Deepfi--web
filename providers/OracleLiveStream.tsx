"use client";

/** Mounts the live oracle SSE stream app-wide (inside the query client). */
import { useOracleLiveStream } from "@/hooks/useOracleLiveStream";

export function OracleLiveStream() {
  useOracleLiveStream();
  return null;
}

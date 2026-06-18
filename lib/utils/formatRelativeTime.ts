import { formatDistanceToNow } from "date-fns";

/**
 * Formats a date string or Date object to a compact relative time format
 * Examples: "2m", "1h", "3d", "2w"
 * @param date - Date string (ISO format) or Date object
 * @returns Compact relative time string (e.g., "2m", "1h", "3d")
 */
export function formatRelativeTime(date: string | Date): string {
  if (!date) return "";

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return "";
    }

    // Get relative time string (e.g., "2 minutes ago", "1 hour ago")
    const relativeTime = formatDistanceToNow(dateObj, { addSuffix: false });

    // Convert to compact format
    // "2 minutes" -> "2m", "1 hour" -> "1h", "3 days" -> "3d", etc.
    const compactTime = relativeTime
      .replace(/\s*(minute|minutes)\s*/gi, "m")
      .replace(/\s*(hour|hours)\s*/gi, "h")
      // .replace(/\s*(day|days)\s*/gi, "d")
      .replace(/\s*(week|weeks)\s*/gi, "w")
      .replace(/\s*(month|months)\s*/gi, "mo")
      .replace(/\s*(year|years)\s*/gi, "y")
      .replace(/\s*ago\s*/gi, "")
      .trim();

    return compactTime;
  } catch (error) {
    console.error("Error formatting relative time:", error);
    return "";
  }
}

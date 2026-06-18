/**
 * Format timestamp in milliseconds to "DD/MM/YYYY - HH:MM:SS"
 */
export const formatTime = (timeMs: number): string => {
  const timestamp = new Date(timeMs);
  const day = String(timestamp.getDate()).padStart(2, "0");
  const month = String(timestamp.getMonth() + 1).padStart(2, "0");
  const year = timestamp.getFullYear();
  const hours = String(timestamp.getHours()).padStart(2, "0");
  const minutes = String(timestamp.getMinutes()).padStart(2, "0");
  const seconds = String(timestamp.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} - ${hours}:${minutes}:${seconds}`;
};

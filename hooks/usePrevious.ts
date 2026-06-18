import { useEffect, useRef } from "react";

/**
 * Custom hook to track the previous value of a prop or state
 * @param value The current value to track
 * @returns The previous value
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  // Reading ref.current during render is intentional: return value from prior render cycle.
  // eslint-disable-next-line react-hooks/refs -- canonical usePrevious pattern
  return ref.current;
}

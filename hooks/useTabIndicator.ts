import { useState, useEffect, useRef, useCallback } from "react";

interface TabIndicatorReturn {
  listRef: React.RefObject<HTMLDivElement | null>;
  indicator: { left: number; width: number };
}

export const useTabIndicator = (
  activeTab: string,
  triggerRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>,
  _paddingX: number = 0
): TabIndicatorReturn => {
  void _paddingX;
  const listRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  const updateIndicator = useCallback(() => {
    const activeEl = triggerRefs.current[activeTab];
    if (!activeEl) return;
    setIndicator({
      left: activeEl.offsetLeft,
      width: activeEl.offsetWidth,
    });
  }, [activeTab, triggerRefs]);

  useEffect(() => {
    queueMicrotask(() => updateIndicator());
  }, [activeTab, updateIndicator]);

  useEffect(() => {
    const handle = () => updateIndicator();
    window.addEventListener("resize", handle);
    const ro = new ResizeObserver(handle);
    if (listRef.current) ro.observe(listRef.current);
    return () => {
      window.removeEventListener("resize", handle);
      ro.disconnect();
    };
  }, [updateIndicator]);

  return { listRef, indicator };
};

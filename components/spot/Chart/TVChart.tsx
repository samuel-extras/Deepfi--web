"use client";

/**
 * TradingView advanced chart for DeepBook pools — vendored charting_library
 * (public/static) + the DeepBook datafeed. Theme and feature set mirror the
 * dex terminal (dark #121417, green/red candles, volume overlay).
 *
 * Shared trading UI: reused by both the spot and margin terminals.
 */
import { useEffect, useRef, useState } from "react";
import { deepbookDatafeed } from "@/lib/deepbookDatafeed";
import {
  CHARTING_LIBRARY_BASE_URL,
  CHARTING_LIBRARY_SCRIPT_URL,
  CHART_CUSTOM_THEME_URL,
} from "@/constants/chart";
import type {
  ChartingLibraryWidgetOptions,
  LanguageCode,
  ResolutionString,
} from "@/types/charting-library";

type TVWidget = {
  onChartReady: (cb: () => void) => void;
  activeChart: () => {
    onIntervalChanged: () => {
      subscribe: (ctx: unknown, cb: () => void) => void;
    };
    resetData: () => void;
    setSymbol: (symbol: string, options?: unknown) => Promise<boolean>;
  };
  resetCache: () => void;
  remove: () => void;
};

declare global {
  interface Window {
    TradingView: {
      widget: new (options: ChartingLibraryWidgetOptions) => TVWidget;
    };
  }
}

// module-level singleton so route transitions don't pay widget teardown/boot
let widgetInstance: TVWidget | null = null;
let containerElement: HTMLDivElement | null = null;
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

const clearScheduledCleanup = () => {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
};

const removeWidget = () => {
  if (!widgetInstance) return;
  try {
    widgetInstance.remove();
  } catch {
    // widget may already be detached
  }
  widgetInstance = null;
  containerElement = null;
};

const CHART_THEME = {
  theme: "dark" as const,
  overrides: {
    "paneProperties.background": "#121417",
    "paneProperties.backgroundType": "solid",
    "paneProperties.vertGridProperties.visible": false,
    "paneProperties.horzGridProperties.visible": false,
    "scalesProperties.textColor": "#ffffff",
    "scalesProperties.lineColor": "#ffffff10",
    "mainSeriesProperties.candleStyle.upColor": "#02DA8B",
    "mainSeriesProperties.candleStyle.downColor": "#ff4d4f",
    "mainSeriesProperties.candleStyle.borderUpColor": "#02DA8B",
    "mainSeriesProperties.candleStyle.borderDownColor": "#ff4d4f",
    "mainSeriesProperties.candleStyle.wickUpColor": "#02DA8B",
    "mainSeriesProperties.candleStyle.wickDownColor": "#ff4d4f",
    "paneProperties.topMargin": 5,
    "paneProperties.bottomMargin": 5,
    volumePaneSize: "small",
  },
} as const;

const DISABLED_FEATURES = [
  "header_symbol_search",
  "header_compare",
  "header_undo_redo",
  "header_screenshot",
  "header_settings",
  "header_saveload",
  "control_bar",
  "border_around_the_chart",
  "popup_hints",
  "side_toolbar_in_fullscreen_mode",
  "edit_buttons_in_legend",
  "context_menus",
  "legend_context_menu",
  "pane_context_menu",
  "source_selection_markers",
  "study_templates",
  "symbol_info",
  "display_market_status",
];

const ENABLED_FEATURES = [
  "timeframes_toolbar",
  "create_volume_indicator_by_default",
  "volume_force_overlay",
];

const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};

// The charting library instruments itself with performance.measure() against
// marks that Next/React dev tooling can clear, and the resulting DOMException
// aborts the chart's boot ("'NotFound' cannot have a negative time stamp").
// The measurements are diagnostics only — make them non-fatal, once.
let perfPatched = false;
const makePerformanceMeasureNonFatal = () => {
  if (perfPatched || typeof performance === "undefined") return;
  perfPatched = true;
  const original = performance.measure.bind(performance);
  performance.measure = ((...args: Parameters<typeof original>) => {
    try {
      return original(...args);
    } catch {
      return undefined as never;
    }
  }) as typeof performance.measure;
};

export default function TVChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isChartReady, setIsChartReady] = useState(false);
  const [dismissedOverlay, setDismissedOverlay] = useState(false);
  const loading = !dismissedOverlay && !isChartReady;

  // widget boot / reuse
  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;
    clearScheduledCleanup();

    const containerInDOM =
      widgetInstance && containerElement && document.body.contains(containerElement);
    if (widgetInstance && containerInDOM) {
      containerElement = currentContainer;
      queueMicrotask(() => {
        setIsChartReady(true);
        setDismissedOverlay(true);
      });
      return;
    }

    const initialize = () => {
      try {
        makePerformanceMeasureNonFatal();
        removeWidget();
        deepbookDatafeed.clearCache();
        const options: ChartingLibraryWidgetOptions = {
          symbol,
          datafeed: deepbookDatafeed as never,
          interval: "60" as ResolutionString,
          container: currentContainer,
          library_path: CHARTING_LIBRARY_BASE_URL,
          locale: "en" as LanguageCode,
          timezone: getUserTimezone() as never,
          ...CHART_THEME,
          custom_css_url: CHART_CUSTOM_THEME_URL,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          disabled_features: DISABLED_FEATURES as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          enabled_features: ENABLED_FEATURES as any,
          client_id: "deepfi",
          user_id: "deepfi_user",
          fullscreen: false,
          autosize: true,
          loading_screen: { backgroundColor: "#121417" },
          studies_overrides: {
            "volume.volume.color.0": "rgba(255, 77, 79, 0.30)",
            "volume.volume.color.1": "rgba(2, 218, 139, 0.30)",
          },
          favorites: { intervals: ["5", "60", "1D"] as ResolutionString[] },
        };
        const widget = new window.TradingView.widget(options);
        widgetInstance = widget;
        containerElement = currentContainer;
        widget.onChartReady(() => {
          setIsChartReady(true);
          setDismissedOverlay(true);
          const chart = widget.activeChart();
          chart.onIntervalChanged().subscribe(null, () => {
            widget.resetCache();
            chart.resetData();
          });
        });
      } catch (e) {
        console.error("TradingView init failed:", e);
        widgetInstance = null;
        containerElement = null;
      }
    };

    if (window.TradingView?.widget) {
      initialize();
    } else {
      const script = document.createElement("script");
      script.src = CHARTING_LIBRARY_SCRIPT_URL;
      script.onload = initialize;
      script.onerror = () => console.error("Failed to load charting library");
      document.head.appendChild(script);
    }

    return () => {
      if (widgetInstance && containerElement === currentContainer) {
        clearScheduledCleanup();
        cleanupTimer = setTimeout(() => {
          if (widgetInstance && containerElement === currentContainer) {
            removeWidget();
          }
        }, 1500);
      }
      setIsChartReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // symbol switching on the live widget
  useEffect(() => {
    if (!widgetInstance || !isChartReady || !symbol) return;
    const update = async () => {
      try {
        const chart = widgetInstance?.activeChart();
        if (!chart) return;
        widgetInstance?.resetCache();
        chart.resetData();
        await chart.setSymbol(symbol);
      } catch (e) {
        console.error("Chart symbol update failed:", e);
      }
    };
    void update();
  }, [symbol, isChartReady]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#121417]">
          <div className="h-10 w-10 animate-pulse rounded-full bg-primary/30" />
        </div>
      )}
    </div>
  );
}

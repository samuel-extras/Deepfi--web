"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type PieChartData = {
  name: string;
  value: number;
  color?: string;
};

type CustomPieChartProps = {
  data: PieChartData[];
  size?: number;
  cornerRadius?: number;
  animationDuration?: number;
  totalTitle: string;
  totalValue: string;
};

type Segment = PieChartData & {
  startAngle: number;
  endAngle: number;
  percentage: number;
};

const DEFAULT_SLICE: PieChartData = {
  name: "USDC",
  value: 100,
  color: "#02DA8B",
};

const CustomPieChart: React.FC<CustomPieChartProps> = ({
  data,
  size = 184,
  cornerRadius = 8.61,
  animationDuration = 600,
  totalTitle,
  totalValue,
}) => {
  const { sanitizedData } = useMemo(() => {
    const invalid = !Array.isArray(data) || data.length === 0;
    if (invalid) {
      return { sanitizedData: [DEFAULT_SLICE] };
    }

    const mapped = data
      .map(item => ({
        name: item.name,
        value: Number(item.value) || 0,
        color: item.color || "#02DA8B",
      }))
      .filter(item => item.value > 0);

    if (mapped.length === 0) {
      return { sanitizedData: [DEFAULT_SLICE] };
    }

    const total = mapped.reduce((sum, item) => sum + item.value, 0);
    if (!Number.isFinite(total) || total <= 0) {
      return { sanitizedData: [DEFAULT_SLICE] };
    }

    return { sanitizedData: mapped };
  }, [data]);

  const [progress, setProgress] = useState(0);
  const animationCancelRef = useRef(false);

  const center = size / 2;
  const radius = size / 2 - 20;
  const innerRadius = radius * 0.85;
  const DESIRED_GAP_ANGLE = 12; // degrees between slices

  const totalValueNumeric = useMemo(
    () => sanitizedData.reduce((sum, item) => sum + item.value, 0),
    [sanitizedData]
  );

  const { gapAngle, availableAngle } = useMemo(() => {
    if (sanitizedData.length === 0) {
      return {
        gapAngle: 0,
        availableAngle: 360,
      };
    }

    const maxGap = Math.max(0, 360 / sanitizedData.length - 0.1);
    const adjustedGap = Math.min(DESIRED_GAP_ANGLE, maxGap);
    const totalGap = adjustedGap * sanitizedData.length;
    const available = Math.max(0, 360 - totalGap);

    return {
      gapAngle: adjustedGap,
      availableAngle: available,
    };
  }, [sanitizedData.length]);

  const segments: Segment[] = useMemo(() => {
    if (!Number.isFinite(totalValueNumeric) || totalValueNumeric <= 0) {
      return [];
    }

    return sanitizedData.map((item, index) => {
      const startAngle = sanitizedData
        .slice(0, index)
        .reduce(
          (sum, prevItem) =>
            sum +
            (prevItem.value / totalValueNumeric) * availableAngle +
            gapAngle,
          0
        );

      const endAngle =
        startAngle + (item.value / totalValueNumeric) * availableAngle;

      return {
        ...item,
        startAngle,
        endAngle,
        percentage: (item.value / totalValueNumeric) * 100,
      };
    });
  }, [sanitizedData, totalValueNumeric, availableAngle, gapAngle]);

  useEffect(() => {
    animationCancelRef.current = false;
    const duration = Math.max(600, animationDuration);
    let start = 0;
    let rafId: number;

    const tick = (now: number) => {
      if (animationCancelRef.current) return;

      if (!start) start = now;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setProgress(eased);

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(now => {
      setProgress(0);
      tick(now);
    });

    return () => {
      animationCancelRef.current = true;
      cancelAnimationFrame(rafId);
    };
  }, [animationDuration]);

  const polarToCartesian = (
    centerX: number,
    centerY: number,
    r: number,
    angle: number
  ) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: centerX + r * Math.cos(rad),
      y: centerY + r * Math.sin(rad),
    };
  };

  const createRoundedArcPath = (
    startAngle: number,
    endAngle: number,
    innerR: number,
    outerR: number,
    radiusCorner: number
  ) => {
    const segmentWidth = outerR - innerR;
    const actualCornerRadius = Math.min(radiusCorner, segmentWidth / 8);
    const cornerAngleOffset = (actualCornerRadius / outerR) * (180 / Math.PI);

    const adjustedStart = startAngle + cornerAngleOffset;
    const adjustedEnd = endAngle - cornerAngleOffset;

    const outerStart = polarToCartesian(center, center, outerR, adjustedStart);
    const outerEnd = polarToCartesian(center, center, outerR, adjustedEnd);
    const innerStart = polarToCartesian(center, center, innerR, adjustedStart);
    const endInnerCorner = polarToCartesian(center, center, innerR, endAngle);
    const startOuterCorner = polarToCartesian(
      center,
      center,
      outerR,
      startAngle
    );

    const largeArcFlag = adjustedEnd - adjustedStart <= 180 ? "0" : "1";

    return [
      "M",
      outerStart.x,
      outerStart.y,
      "A",
      outerR,
      outerR,
      0,
      largeArcFlag,
      1,
      outerEnd.x,
      outerEnd.y,
      "A",
      actualCornerRadius,
      actualCornerRadius,
      0,
      0,
      1,
      endInnerCorner.x,
      endInnerCorner.y,
      "A",
      innerR,
      innerR,
      0,
      largeArcFlag,
      0,
      innerStart.x,
      innerStart.y,
      "A",
      actualCornerRadius,
      actualCornerRadius,
      0,
      0,
      1,
      startOuterCorner.x,
      startOuterCorner.y,
      "Z",
    ].join(" ");
  };

  const [hoveredSegment, setHoveredSegment] = useState<Segment | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const formatValue = (value: number) => {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseLeave={() => setHoveredSegment(null)}
    >
      <svg width={size} height={size}>
        {segments.map((segment, index) => {
          if (progress <= 0) return null;

          const currentEnd =
            segment.startAngle +
            (segment.endAngle - segment.startAngle) * progress;

          const path = createRoundedArcPath(
            segment.startAngle,
            currentEnd,
            innerRadius,
            radius,
            cornerRadius
          );

          return (
            <path
              key={index}
              d={path}
              fill={segment.color}
              onMouseEnter={() => setHoveredSegment(segment)}
              onMouseMove={e => {
                const rect =
                  e.currentTarget.parentElement?.getBoundingClientRect();
                if (rect) {
                  setTooltipPos({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }
              }}
              style={{ cursor: "pointer" }}
            />
          );
        })}
      </svg>

      <div
        style={{
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            color: "#A9A9A9",
            fontSize: 12,
            lineHeight: "16px",
          }}
        >
          {totalTitle}
        </span>
        <span
          style={{
            color: "white",
            fontSize: 14,
            fontWeight: 500,
            lineHeight: "16px",
          }}
        >
          {totalValue}
        </span>
      </div>

      {hoveredSegment && (
        <div
          style={{
            position: "absolute",
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translate(-50%, -100%) translateY(-10px)",
            backgroundColor: "#1A1D1F",
            border: "1px solid #2D3134",
            borderRadius: "8px",
            padding: "12px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            pointerEvents: "none",
            zIndex: 50,
            minWidth: "120px",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-2.5 h-2.5 rounded"
              style={{ backgroundColor: hoveredSegment.color }}
            />
            <p className="text-xs text-nav-inactive">{hoveredSegment.name}</p>
          </div>
          <p className="text-sm text-white font-semibold">
            ${formatValue(hoveredSegment.value)}
          </p>
        </div>
      )}
    </div>
  );
};

export default CustomPieChart;

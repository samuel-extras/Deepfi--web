"use client";

import React, { useEffect, useState } from "react";
import { usePrevious } from "@/hooks/usePrevious";
import { cn } from "@/lib/utils";

interface AnimatedValueProps {
  value: string | number;
  className?: string;
  showColorFlash?: boolean;
  neutralColor?: string;
  transitionDuration?: number;
  disableFade?: boolean;
}

type Direction = "up" | "down" | "neutral";

/**
 * Extract numeric value from formatted string or return number as-is
 * Examples: "$1,234.56" -> 1234.56, "1.23%" -> 1.23, "-" -> null
 */
function extractNumericValue(value: string | number): number | null {
  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }

  if (!value || value === "-" || value === "—") {
    return null;
  }

  // Remove common formatting characters: $, %, commas, spaces
  const cleaned = value.replace(/[$,%\s]/g, "");
  const num = parseFloat(cleaned);

  return isNaN(num) ? null : num;
}

/**
 * Compare current and previous values to determine direction
 * Returns null if values are too close (< 0.01% difference) to avoid noise
 */
function getDirection(
  current: number | null,
  previous: number | null
): Direction {
  if (current === null || previous === null) {
    return "neutral";
  }

  const diff = current - previous;
  const percentChange = Math.abs(diff / previous) * 100;

  // Ignore trivial changes (< 0.01%)
  if (percentChange < 0.01) {
    return "neutral";
  }

  return diff > 0 ? "up" : diff < 0 ? "down" : "neutral";
}

export const AnimatedValue: React.FC<AnimatedValueProps> = ({
  value,
  className = "",
  showColorFlash = false,
  neutralColor = "",
  transitionDuration = 800,
  disableFade = false,
}) => {
  const previousValue = usePrevious(value);
  const [direction, setDirection] = useState<Direction>("neutral");
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (previousValue === undefined) {
      // First render, no animation
      return;
    }

    const currentNumeric = extractNumericValue(value);
    const previousNumeric = extractNumericValue(previousValue);

    const newDirection = getDirection(currentNumeric, previousNumeric);

    // Trigger animation on any value change
    if (newDirection !== "neutral") {
      // Reset animation to allow re-trigger
      queueMicrotask(() => setIsAnimating(false));

      // Start new animation on next frame
      requestAnimationFrame(() => {
        setDirection(newDirection);
        setIsAnimating(true);

        // Reset everything after animation completes
        const timer = setTimeout(() => {
          setIsAnimating(false);
          setDirection("neutral");
        }, transitionDuration);

        return () => clearTimeout(timer);
      });
    }
  }, [value, previousValue, transitionDuration]);

  const getAnimationClasses = () => {
    if (!isAnimating) return "";

    const animations = [];

    // Fade animation (opacity pulse)
    if (!disableFade) {
      animations.push("animate-value-fade");
    }

    // Color pulse animation
    if (showColorFlash) {
      animations.push(
        direction === "up" ? "animate-pulse-green" : "animate-pulse-red"
      );
    }

    return animations.join(" ");
  };

  return (
    <span
      className={cn(
        "inline-block tabular-nums",
        neutralColor,
        className,
        getAnimationClasses()
      )}
      style={{
        willChange: "color, opacity",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </span>
  );
};

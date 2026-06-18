import React, { useEffect, useState } from "react";

type Props = {
  status: "loading" | "success";
  size?: number;
  strokeWidth?: number;
  color?: string;
  useArcOnly?: boolean;
};

export default function AuthLoadingAnimation({
  status,
  size = 64,
  strokeWidth = 3,
  color = "#02DA8B",
  useArcOnly = false,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const [animateRing, setAnimateRing] = useState(false);

  useEffect(() => {
    if (status === "success" && !useArcOnly) {
      const t = setTimeout(() => setAnimateRing(true), 50);
      return () => clearTimeout(t);
    } else {
      queueMicrotask(() => setAnimateRing(false));
    }
  }, [status, useArcOnly]);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {(status === "loading" || useArcOnly) && (
        <div
          className="absolute animate-spin"
          style={{
            width: size,
            height: size,
            animationDuration: "0.9s",
            animationTimingFunction: "linear",
          }}
        >
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference * 0.25}, ${circumference}`}
            />
          </svg>
        </div>
      )}

      {!useArcOnly && status === "success" && (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animateRing ? 0 : circumference}
            style={{
              transition:
                "stroke-dashoffset 0.6s cubic-bezier(0.55, 0, 0.1, 1)",
            }}
          />
          <path
            d="M0.5 13.1667C0.5 13.1667 4.76667 15.6 6.9 19.1667C6.9 19.1667 13.3 5.16667 21.8333 0.5"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            transform={`translate(${(size - 23) / 2}, ${(size - 20) / 2})`}
            style={{
              opacity: animateRing ? 1 : 0,
              transition: "opacity 0.4s ease 0.3s",
            }}
          />
        </svg>
      )}
    </div>
  );
}

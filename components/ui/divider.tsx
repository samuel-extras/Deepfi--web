import * as React from "react";
import { cn } from "@/lib/utils";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  size?: string;
}

const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, orientation = "horizontal", size, style, ...props }, ref) => {
    const isVertical = orientation === "vertical";

    const customStyle = React.useMemo(() => {
      if (!size) return style;

      const sizeProperty = isVertical ? "height" : "width";
      return {
        ...style,
        [sizeProperty]: size,
      };
    }, [size, isVertical, style]);

    return (
      <div
        ref={ref}
        className={cn(
          "bg-border",
          isVertical ? "w-px self-stretch" : "h-px w-full",
          className
        )}
        style={customStyle}
        {...props}
      />
    );
  }
);

Divider.displayName = "Divider";

export { Divider };

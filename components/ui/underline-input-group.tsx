"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function UnderlineInputGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="underline-input-group"
      role="group"
      className={cn(
        "group/underline-input flex w-full items-center gap-2 h-10",
        "border-b border-white/20 transition-colors duration-200",
        "hover:border-primary focus-within:border-primary",
        className
      )}
      {...props}
    />
  );
}

function UnderlineInputGroupAddon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="underline-input-group-addon"
      className={cn("flex items-center gap-2 text-xs text-white", className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

function UnderlineInputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="underline-input-group-input"
      className={cn(
        "flex-1 bg-transparent outline-none",
        "text-white placeholder:text-[#A9A9A9]",
        "h-10 px-0 py-0 border-0",
        className
      )}
      {...props}
    />
  );
}

export {
  UnderlineInputGroup,
  UnderlineInputGroupAddon,
  UnderlineInputGroupInput,
};

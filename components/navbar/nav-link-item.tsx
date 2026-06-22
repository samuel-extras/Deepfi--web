"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { enqueueRoutePrefetch } from "@/lib/perf/prefetchQueue";

import type { SimpleItem } from ".";

const isPlainLeftClick = (
  event: React.MouseEvent<HTMLAnchorElement>,
): boolean => {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
};

const isTradeRoute = (href: string): boolean => {
  return href.startsWith("/trade");
};

const getTradeRouteSegmentCount = (path: string): number => {
  const segments = path?.split("/")?.filter(Boolean);
  return segments.length > 0 && segments[0] === "trade"
    ? segments.length - 1
    : -1;
};

const getNavItemActiveState = (
  item: SimpleItem,
  pathname: string | null,
): boolean => {
  if (!pathname) return false;

  if (isTradeRoute(item.href)) {
    // For trade routes, check segment count match
    const pathSegmentCount = getTradeRouteSegmentCount(pathname);
    const hrefSegmentCount = getTradeRouteSegmentCount(item.href);

    return (
      pathname === item.href ||
      (pathSegmentCount >= 0 && pathSegmentCount === hrefSegmentCount)
    );
  }

  // For regular routes, check exact match or prefix
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
};

export function NavLinkItem({
  href,
  label,
  iconLeft,
  isActive,
  onNavigateStart,
}: {
  href: string;
  label: string;
  iconLeft?: React.ReactNode;
  isActive: boolean;
  onNavigateStart?: (href: string) => void;
}) {
  const router = useRouter();

  const [active, setActive] = React.useState(false);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!isPlainLeftClick(event)) return;
      onNavigateStart?.(href);
    },
    [href, onNavigateStart],
  );

  const handleIntentPrefetch = React.useCallback(() => {
    setActive(true);
    enqueueRoutePrefetch(href, (target) => router.prefetch(target));
  }, [href, router]);

  return (
    <Link
      href={href}
      prefetch={active ? null : false}
      onClick={handleClick}
      onMouseEnter={handleIntentPrefetch}
      onFocus={handleIntentPrefetch}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-sm transition-colors",
        "text-xs leading-[18px] font-normal",
        isActive
          ? "text-white font-semibold"
          : "text-white/80 lg:hover:text-white",
      )}
    >
      {iconLeft}
      <span>{label}</span>
    </Link>
  );
}

function NavDropdownItemRow({
  item,
  pathname,
  onNavigateStart,
}: {
  item: SimpleItem;
  pathname: string | null;
  onNavigateStart?: (href: string) => void;
}) {
  const router = useRouter();
  const [active, setActive] = React.useState(false);
  const isActive = getNavItemActiveState(item, pathname);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return;
    onNavigateStart?.(item.href);
  };

  const handleIntentPrefetch = () => {
    setActive(true);
    enqueueRoutePrefetch(item.href, (target) => router.prefetch(target));
  };

  return (
    <Link
      href={item.href}
      prefetch={active ? null : false}
      onClick={handleClick}
      onMouseEnter={handleIntentPrefetch}
      onFocus={handleIntentPrefetch}
    >
      <DropdownMenuItem
        className={cn(
          "text-xs leading-[18px] font-normal lg:hover:bg-[#02DA8B26] lg:hover:text-primary hover:cursor-pointer",
          isActive
            ? "text-white font-semibold"
            : "text-white/80 lg:hover:text-white",
        )}
      >
        {item.iconLeft}
        <span>{item.label}</span>
      </DropdownMenuItem>
    </Link>
  );
}

export function NavDropdown({
  label,
  items,
  iconLeft,
  anyActive,
  pathname,
  onNavigateStart,
}: {
  label: string;
  items: SimpleItem[];
  iconLeft?: React.ReactNode;
  anyActive: boolean;
  pathname: string | null;
  onNavigateStart?: (href: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 px-3 py-2 rounded-sm transition-colors hover:cursor-pointer text-xs leading-[18px] font-normal",
            anyActive
              ? "text-primary"
              : "text-nav-inactive lg:hover:text-white",
          )}
          type="button"
        >
          {iconLeft}
          <span>{label}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-[#0f1113] border-white/10">
        {items.map((c) => (
          <NavDropdownItemRow
            key={c.href}
            item={c}
            pathname={pathname}
            onNavigateStart={onNavigateStart}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

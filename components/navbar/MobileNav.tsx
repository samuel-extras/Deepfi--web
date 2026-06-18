"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { LogoIcon } from "@/components/icons";
import type { Item, SimpleItem } from "./index";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { enqueueRoutePrefetch } from "@/lib/perf/prefetchQueue";

const isPlainLeftClick = (
  event: React.MouseEvent<HTMLAnchorElement>
): boolean => {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
};

type MobileNavProps = {
  navItems: Item[];
  pathname: string | null;
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  onConnect: () => void;
  onLogout: () => void;
  onNavigateStart?: (href: string) => void;
};

type MobileNavLinkProps = {
  href: string;
  label: string;
  iconLeft?: React.ReactNode;
  isActive: boolean;
  onNavigate: () => void;
  onNavigateStart?: (href: string) => void;
};

type DropdownItem = {
  label: string;
  iconLeft?: React.ReactNode;
  children: SimpleItem[];
  activePrefix?: string;
};

function isDropdown(item: Item): item is DropdownItem {
  return (item as DropdownItem).children !== undefined;
}

const isTradeRoute = (href: string): boolean => {
  return href.startsWith("/trade");
};

const getTradeRouteSegmentCount = (path: string): number => {
  const segments = path?.split("/")?.filter(Boolean);
  return segments?.length > 0 && segments?.[0] === "trade"
    ? segments.length - 1
    : -1;
};

const getNavItemActiveState = (
  item: SimpleItem,
  pathname: string | null
): boolean => {
  if (!pathname) return false;

  if (isTradeRoute(item.href)) {
    const pathSegmentCount = getTradeRouteSegmentCount(pathname);
    const hrefSegmentCount = getTradeRouteSegmentCount(item.href);

    return (
      pathname === item.href ||
      (pathSegmentCount >= 0 && pathSegmentCount === hrefSegmentCount)
    );
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
};

const MobileNavLink = ({
  href,
  label,
  iconLeft,
  isActive,
  onNavigate,
  onNavigateStart,
}: MobileNavLinkProps) => {
  const router = useRouter();

  const [active, setActive] = React.useState(false);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (isPlainLeftClick(event)) {
        onNavigateStart?.(href);
      }
      onNavigate();
    },
    [href, onNavigate, onNavigateStart]
  );

  const handleIntentPrefetch = React.useCallback(() => {
    setActive(true);
    enqueueRoutePrefetch(href, target => router.prefetch(target));
  }, [href, router]);

  return (
    <Link
      href={href}
      prefetch={active ? null : false}
      onClick={handleClick}
      onMouseEnter={handleIntentPrefetch}
      onFocus={handleIntentPrefetch}
      className={`flex items-center gap-0 rounded-full text-base transition-colors py-2 ${
        isActive ? "text-primary" : "text-white/70"
      }`}
    >
      <span className="flex items-center gap-2">
        {label}
        {iconLeft && <span className="shrink-0 text-white/90">{iconLeft}</span>}
      </span>
    </Link>
  );
};

export const MobileNav = ({
  navItems,
  pathname,
  isOpen,
  onClose,
  isAuthenticated,
  onConnect,
  onLogout,
  onNavigateStart,
}: MobileNavProps) => {
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  if (!isMounted || (!isOpen && !isAnimating)) return null;

  const portalTarget =
    typeof document !== "undefined" ? document.body : undefined;

  if (!portalTarget) return null;

  const content = (
    <div className="relative h-full lg:hidden">
      <div
        className={`fixed inset-0 z-99999 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />
      <aside
        className={`fixed right-0 top-0 z-99999 h-screen w-62 border-l border-border bg-[#121417] shadow-2xl shadow-black/50 transition-transform duration-300 ease-out lg:hidden ${
          isAnimating ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Mobile navigation"
      >
        <ScrollArea className="h-full">
          <div className="flex min-h-full flex-col px-6 pb-4">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-[#121417] py-4">
              <Link
                href="/"
                prefetch={false}
                onClick={handleClose}
                className="flex items-center"
                aria-label="Navigate home"
              >
                <LogoIcon />
              </Link>
              <button
                type="button"
                onClick={handleClose}
                className="text-white/60 transition-colors"
                aria-label="Close menu"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <nav className="flex-1 space-y-4 pb-4 pr-2">
              {navItems?.map(item => {
                if (isDropdown(item)) {
                  const anyActive =
                    (item.activePrefix &&
                      pathname?.startsWith(item.activePrefix)) ||
                    item.children.some(
                      c =>
                        pathname === c.href ||
                        pathname?.startsWith(c.href + "/")
                    );

                  return (
                    <div key={item.label} className="space-y-2">
                      <div className="flex items-center gap-x-2">
                        <p
                          className={cn(
                            "text-xs uppercase tracking-wide transition-colors",
                            anyActive ? "text-primary" : "text-white/50"
                          )}
                        >
                          {item.label}
                        </p>
                        {item.iconLeft && (
                          <span className="shrink-0 text-white/90">
                            {item.iconLeft}
                          </span>
                        )}
                      </div>
                      <div className="pl-2">
                        {item.children.map(child => (
                          <MobileNavLink
                            key={child.href}
                            href={child.href}
                            label={child.label}
                            iconLeft={child.iconLeft}
                            isActive={getNavItemActiveState(child, pathname)}
                            onNavigate={handleClose}
                            onNavigateStart={onNavigateStart}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }

                const simpleItem = item as SimpleItem;
                return (
                  <MobileNavLink
                    key={simpleItem.href}
                    href={simpleItem.href}
                    label={simpleItem.label}
                    iconLeft={simpleItem.iconLeft}
                    isActive={getNavItemActiveState(simpleItem, pathname)}
                    onNavigate={handleClose}
                    onNavigateStart={onNavigateStart}
                  />
                );
              })}
            </nav>

            <div className="sticky bottom-0 z-10 space-y-3 border-t border-white/5 bg-[#121417] pt-4 pb-20">
              {!isAuthenticated ? (
                <Button
                  className="w-full rounded-full text-sm font-semibold text-[#0E0E0E]"
                  type="button"
                  onClick={() => {
                    onConnect();
                    handleClose();
                  }}
                >
                  Connect
                </Button>
              ) : (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full rounded-full border-white/20 text-sm font-semibold text-white"
                    type="button"
                    onClick={() => {
                      onLogout();
                      handleClose();
                    }}
                  >
                    Logout
                  </Button>
                </div>
              )}
            </div>
          </div>
          <ScrollBar />
        </ScrollArea>
      </aside>
    </div>
  );

  return createPortal(content, portalTarget);
};

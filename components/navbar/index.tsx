"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { NavLinkItem, NavDropdown } from "./nav-link-item";
import { Button } from "@/components/ui/button";
import { CompetitionIcon, EarnIcon, LogoIcon } from "@/components/icons";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePrivy } from "@privy-io/react-auth";
import UserMenu from "./UserMenu";
import { useDisconnect } from "wagmi";
import { useDisconnectWallet } from "@mysten/dapp-kit";
import { ConnectWalletDialog } from "@/components/wallet/ConnectWalletDialog";
import { MobileNav } from "./MobileNav";
import { HamburgerIcon } from "./HamburgerIcon";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { SettingsDropdown } from "./SettingsDropdown";
import { useAppSettingsStore } from "@/stores/useAppSettingsStore";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import {
  completeNavigationTracking,
  startNavigationTracking,
} from "@/lib/perf/navigation";
import { enqueueRoutePrefetch } from "@/lib/perf/prefetchQueue";

export type SimpleItem = {
  href: string;
  label: string;
  iconLeft?: React.ReactNode;
};
export type DropdownItem = {
  label: string;
  iconLeft?: React.ReactNode;
  children: SimpleItem[];
  activePrefix?: string;
};
export type Item = SimpleItem | DropdownItem;

export const navItems: Item[] = [
  { href: "/spot/DBUSDC/SUI", label: "Spot" },
  { href: "/margin/DBUSDC/SUI", label: "Margin" },
  {
    href: "/prediction",
    label: "Prediction",
  },
  { href: "/prediction/surface", label: "Surface" },
  { href: "/prediction/risk", label: "Risk" },
  {
    href: "/portfolio",
    label: "Portfolio",
  },
  { href: "/earn", label: "Earn", iconLeft: <EarnIcon /> },
  {
    href: "/social",
    label: "Social",
  },
  { href: "/competition", label: "Competition", iconLeft: <CompetitionIcon /> },
];

// Condensed nav for narrower screens — groups less-used links into dropdowns
export const condensedNavItems: Item[] = [
  { href: "/spot/DBUSDC/SUI", label: "Spot" },
  { href: "/margin/DBUSDC/SUI", label: "Margin" },
  { href: "/prediction", label: "Prediction" },
  { href: "/portfolio", label: "Portfolio" },
  {
    label: "More",
    children: [
      { href: "/prediction/surface", label: "Surface" },
      { href: "/prediction/risk", label: "Risk" },
      { href: "/earn", label: "Earn", iconLeft: <EarnIcon /> },
      { href: "/social", label: "Social" },
      {
        href: "/competition",
        label: "Competition",
        iconLeft: <CompetitionIcon />,
      },
    ],
    activePrefix: "/earn",
  },
];

function isDropdown(item: Item): item is DropdownItem {
  return (item as DropdownItem).children !== undefined;
}

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

function renderNavItem(
  item: Item,
  idx: number,
  pathname: string | null,
  onNavigateStart?: (href: string) => void,
) {
  if (isDropdown(item)) {
    const anyActive =
      (item.activePrefix && pathname?.startsWith(item.activePrefix)) ||
      item.children.some(
        (c) => pathname === c.href || pathname?.startsWith(c.href + "/"),
      );
    return (
      <NavDropdown
        key={`dd-${idx}`}
        label={item.label}
        iconLeft={item.iconLeft}
        anyActive={anyActive}
        items={item.children}
        pathname={pathname}
        onNavigateStart={onNavigateStart}
      />
    );
  }

  const isActive = getNavItemActiveState(item as SimpleItem, pathname);
  return (
    <NavLinkItem
      key={(item as SimpleItem).href}
      href={(item as SimpleItem).href}
      label={item.label}
      iconLeft={(item as SimpleItem).iconLeft}
      isActive={isActive}
      onNavigateStart={onNavigateStart}
    />
  );
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, userInfo, logout } = useAuthStore();
  const resetUserProfile = useUserProfileStore((state) => state.reset);
  const { logout: privyLogout, exportWallet } = usePrivy();
  const { disconnect } = useDisconnect();
  const { mutate: disconnectSui } = useDisconnectWallet();
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);
  const [connectOpen, setConnectOpen] = React.useState(false);

  // Get app settings from granular selectors (avoids re-rendering entire
  // Navbar when any unrelated setting changes)
  const hideSmallBalances = useAppSettingsStore((s) => s.hideSmallBalances);
  const hidePnl = useAppSettingsStore((s) => s.hidePnl);
  const animateOrderbook = useAppSettingsStore((s) => s.animateOrderbook);
  const updateSetting = useAppSettingsStore((s) => s.updateSetting);
  const toggleMobileNav = React.useCallback(() => {
    setIsMobileNavOpen((prev) => !prev);
  }, []);

  const handleLogout = React.useCallback(() => {
    // Capture token before clearing store
    const token = useAuthStore.getState().jwtToken;
    // Logout from backend API (non-blocking) - pass token explicitly
    void dexBackendApi.logout(token);
    privyLogout();
    disconnect();
    disconnectSui();
    resetUserProfile();
    logout();
  }, [disconnect, disconnectSui, logout, privyLogout, resetUserProfile]);

  // Map global settings to dropdown format
  const settings = React.useMemo(
    () => [
      {
        id: "hide-small-balances",
        label: "Hide Small Balances",
        checked: hideSmallBalances,
      },
      // {
      //   id: "disable-bg-notifications",
      //   label: "Disable Background Fill Notifications",
      //   checked: disableBackgroundNotifications,
      // },
      { id: "hide-pnl", label: "Hide PNL", checked: hidePnl },
      {
        id: "animate-orderbook",
        label: "Animate Order Book",
        checked: animateOrderbook,
      },
    ],
    [hideSmallBalances, hidePnl, animateOrderbook],
  );

  const handleSettingChange = React.useCallback(
    (id: string, checked: boolean) => {
      switch (id) {
        case "hide-small-balances":
          updateSetting("hideSmallBalances", checked);
          break;
        // case "disable-bg-notifications":
        //   appSettings.updateSetting("disableBackgroundNotifications", checked);
        //   break;
        case "hide-pnl":
          updateSetting("hidePnl", checked);
          break;
        case "animate-orderbook":
          updateSetting("animateOrderbook", checked);
          break;
      }
    },
    [updateSetting],
  );

  const actions = React.useMemo(
    () => [
      {
        id: "export-private-key",
        label: "Export Private Key",
        type: "action" as const,
      },
    ],
    [],
  );

  const handleActionClick = React.useCallback(
    (id: string) => {
      if (id === "export-private-key") {
        void exportWallet().catch((error: unknown) => {
          console.error("Error exporting private key:", error);
        });
      }
    },
    [exportWallet],
  );

  const handleConnectAccount = React.useCallback(() => {
    setConnectOpen(true);
  }, []);

  const handleNavigationStart = React.useCallback(
    (href: string) => {
      if (!pathname || pathname === href) return;
      startNavigationTracking(pathname, href);
    },
    [pathname],
  );

  React.useEffect(() => {
    const prewarmTargets = [
      "/spot/DBUSDC/SUI",
      "/prediction",
      "/earn",
      "/social",
    ];

    const prewarm = () => {
      prewarmTargets.forEach((target) => {
        enqueueRoutePrefetch(target, (href) => router.prefetch(href));
      });
    };

    const win = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let timeoutId: number | null = null;
    let idleId: number | null = null;
    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(prewarm, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(prewarm, 600);
    }

    return () => {
      if (idleId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [router]);

  React.useEffect(() => {
    if (!pathname) return;
    completeNavigationTracking(pathname);
  }, [pathname]);

  const fullNav = React.useMemo(
    () =>
      navItems.map((item, idx) =>
        renderNavItem(item, idx, pathname, handleNavigationStart),
      ),
    [pathname, handleNavigationStart],
  );

  const condensedNav = React.useMemo(
    () =>
      condensedNavItems.map((item, idx) =>
        renderNavItem(item, idx, pathname, handleNavigationStart),
      ),
    [pathname, handleNavigationStart],
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" prefetch={false} className="flex items-center gap-2">
            <LogoIcon />
          </Link>

          {/* Full nav — >= 1400px */}
          <nav className="hidden min-[1400px]:flex items-center gap-1">
            {fullNav}
          </nav>
          {/* Condensed nav — lg to 1399px only */}
          <nav className="hidden lg:max-[1399px]:flex items-center gap-1">
            {condensedNav}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {!isAuthenticated ? (
            <ConnectWalletDialog
              open={connectOpen}
              onOpenChange={setConnectOpen}
              trigger={
                <Button
                  className="font-semibold text-xs text-[#0E0E0E] rounded-[25px] hover:cursor-pointer"
                  type="button"
                >
                  Connect
                </Button>
              }
            />
          ) : (
            <UserMenu
              email={userInfo.email}
              walletAddress={userInfo.walletAddress}
              onLogout={handleLogout}
            />
          )}
          <SettingsDropdown
            settings={settings}
            actions={actions}
            onSettingChange={handleSettingChange}
            onActionClick={handleActionClick}
          />

          <HamburgerIcon isOpen={isMobileNavOpen} onClick={toggleMobileNav} />
        </div>
      </div>
      <MobileNav
        navItems={navItems}
        pathname={pathname}
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        isAuthenticated={isAuthenticated}
        onConnect={handleConnectAccount}
        onLogout={handleLogout}
        onNavigateStart={handleNavigationStart}
      />
    </header>
  );
}

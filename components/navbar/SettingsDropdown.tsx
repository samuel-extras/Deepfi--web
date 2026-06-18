"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { GearIcon } from "@/components/icons";
import {
  ChevronRight,
  Loader2,
  MonitorCogIcon,
  MoonStarIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import React from "react";

const THEME_OPTIONS = [
  {
    icon: MonitorCogIcon,
    value: "system",
  },
  {
    icon: SunIcon,
    value: "light",
  },
  {
    icon: MoonStarIcon,
    value: "dark",
  },
];
interface SettingOption {
  id: string;
  label: string;
  checked: boolean;
  loading?: boolean;
}

interface ActionOption {
  id: string;
  label: string;
  type: "action";
}

type MenuOption = SettingOption | ActionOption;

interface SettingsDropdownProps {
  settings: SettingOption[];
  actions?: ActionOption[];
  onSettingChange: (id: string, checked: boolean) => void;
  onActionClick?: (id: string) => void;
}

function isActionOption(option: MenuOption): option is ActionOption {
  return (option as ActionOption).type === "action";
}

export function SettingsDropdown({
  settings,
  actions = [],
  onSettingChange,
  onActionClick,
}: SettingsDropdownProps) {
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Settings"
          className="inline-flex cursor-pointer h-8 w-8 items-center justify-center rounded-sm text-white/70 lg:hover:text-white lg:hover:bg-white/5 hover:cursor-pointer"
          type="button"
        >
          <GearIcon className="size-5 lg:size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="bg-[#0f1113] border-white/10 min-w-[300px] max-h-[500px] overflow-y-auto"
        align="end"
      >
        {settings.map((setting) => (
          <DropdownMenuItem
            key={setting.id}
            className="flex items-center justify-between px-4 py-2.5 text-sm text-white/70 lg:hover:bg-white/5 hover:cursor-pointer focus:bg-white/5"
            onSelect={() => {
              if (!setting.loading) {
                onSettingChange(setting.id, !setting.checked);
              }
            }}
          >
            <span className="flex-1">{setting.label}</span>
            {setting.loading ? (
              <Loader2 className="size-4 animate-spin text-white/50" />
            ) : (
              <Checkbox
                checked={setting.checked}
                onCheckedChange={(checked) =>
                  onSettingChange(setting.id, checked as boolean)
                }
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </DropdownMenuItem>
        ))}

        {isMounted ? (
          <DropdownMenuItem>
            <motion.div
              key={String(isMounted)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-muted/80 inline-flex items-center overflow-hidden rounded-md border"
              role="radiogroup"
            >
              {THEME_OPTIONS.map((option) => (
                <button
                  className={cn(
                    "relative flex size-7 cursor-pointer items-center justify-center rounded-md transition-all",
                    theme === option.value
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  role="radio"
                  aria-checked={theme === option.value}
                  aria-label={`Switch to ${option.value} theme`}
                  onClick={() => setTheme(option.value)}
                  key={option.value}
                >
                  {theme === option.value && (
                    <motion.div
                      layoutId="theme-option"
                      transition={{
                        type: "spring",
                        bounce: 0.1,
                        duration: 0.75,
                      }}
                      className="border-muted-foreground/50 absolute inset-0 rounded-md border"
                    />
                  )}
                  <option.icon className="size-3.5" />
                </button>
              ))}
            </motion.div>
          </DropdownMenuItem>
        ) : null}
        {actions.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-white/10 my-1" />
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm text-white/70 lg:hover:bg-white/5 hover:cursor-pointer focus:bg-white/5"
                onSelect={() => {
                  onActionClick?.(action.id);
                }}
              >
                <span className="flex-1">{action.label}</span>
                <ChevronRight className="size-4 text-white/50" />
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

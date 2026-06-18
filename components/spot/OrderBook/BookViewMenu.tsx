"use client";

/** Order-book layout picker — kebab menu with Tab / Stacked / Large. */
import { EllipsisVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BookView } from "./types";

export default function BookViewMenu({
  view,
  onViewChange,
}: {
  view: BookView;
  onViewChange: (v: BookView) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Order book layout">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={view}
          onValueChange={v => onViewChange(v as BookView)}
        >
          <DropdownMenuRadioItem value="tab">Tab</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="stacked">Stacked</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="large">Large</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

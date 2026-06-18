// Search + filter + grid/list toolbar — shadcn InputGroup, Button, ToggleGroup.
import { Search, X } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

interface SearchToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  viewMode?: "grid" | "list";
  onViewModeChange?: (mode: "grid" | "list") => void;
  isFilterOpen?: boolean;
  onFilterClick?: () => void;
  showFilter?: boolean;
  showViewMode?: boolean;
  placeholder?: string;
}

export function SearchToolbar({
  searchQuery,
  onSearchChange,
  onClearSearch,

  placeholder = "Search markets…",
}: SearchToolbarProps) {
  return (
    <InputGroup className="w-full sm:max-w-xs rounded-full ">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {searchQuery && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Clear search"
            onClick={onClearSearch}
          >
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

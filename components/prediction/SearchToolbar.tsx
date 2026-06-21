import { Search, Filter, LayoutGrid, LayoutList, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  viewMode?: "grid" | "list";
  onViewModeToggle?: () => void;
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
  viewMode = "grid",
  onViewModeToggle,
  isFilterOpen = false,
  onFilterClick,
  showFilter = true,
  showViewMode = true,
  placeholder = "Search events or users...",
}: SearchToolbarProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
      <div className="relative w-full md:w-[400px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          className="pl-9 pr-8 bg-[#121417] border-white/10 focus-visible:ring-0 focus-visible:ring-offset-0 text-white caret-[#02DA8B]"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={onClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2 w-full md:w-auto">
        {showFilter && (
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "border-white/10 bg-[#121417] hover:bg-white/5",
              isFilterOpen && "border-[#02DA8B] text-[#02DA8B]"
            )}
            onClick={onFilterClick}
          >
            <Filter className="h-4 w-4" />
          </Button>
        )}
        {showViewMode && (
          <Button
            variant="outline"
            size="icon"
            className="hidden md:flex border-white/10 bg-[#121417] hover:bg-white/5"
            onClick={onViewModeToggle}
          >
            {viewMode === "grid" ? (
              <LayoutList className="h-4 w-4" />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

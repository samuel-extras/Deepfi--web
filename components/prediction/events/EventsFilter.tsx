// Filter & sort sheet for the markets list — a shadcn Dialog with ToggleGroup
// option-sets (status / sort / order), Field-wrapped range Inputs, and Buttons.
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Settings2 } from "lucide-react";

export interface FilterState {
  status: "active" | "closed" | "all";
  minVolume?: string;
  maxVolume?: string;
  minLiquidity?: string;
  maxLiquidity?: string;
  startDate?: string;
  endDate?: string;
  sortBy: "volume" | "liquidity" | "startDate" | "endDate";
  sortOrder: "asc" | "desc";
}

interface EventsFilterProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
}

const VOL_PRESETS: { label: string; value: string }[] = [
  { label: "1K", value: "1000" },
  { label: "10K", value: "10000" },
  { label: "100K", value: "100000" },
  { label: "1M", value: "1000000" },
];

export function EventsFilter({ filters, setFilters }: EventsFilterProps) {
  const [localFilters, setLocalFilters] = React.useState<FilterState>(filters);

  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const patch = (p: Partial<FilterState>) =>
    setLocalFilters((prev) => ({ ...prev, ...p }));

  const handleApply = () => {
    setFilters(localFilters);
  };

  const handleReset = () =>
    setLocalFilters({
      status: "active",
      sortBy: "endDate",
      sortOrder: "asc",
      minVolume: "",
      maxVolume: "",
      minLiquidity: "",
      maxLiquidity: "",
      startDate: "",
      endDate: "",
    });

  return (
    <Dialog>
      <form>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Filter and sort"
            className="bg-muted rounded-full"
          >
            <Settings2 />
          </Button>
        </DialogTrigger>
        <DialogContent className="min-w-md w-full">
          <DialogHeader>
            <DialogTitle>Filter &amp; sort</DialogTitle>
            <DialogDescription>Customise the market list.</DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                value={localFilters.status}
                onValueChange={(v) =>
                  v && patch({ status: v as FilterState["status"] })
                }
              >
                <ToggleGroupItem value="active">Active</ToggleGroupItem>
                <ToggleGroupItem value="closed">Closed</ToggleGroupItem>
                <ToggleGroupItem value="all">All</ToggleGroupItem>
              </ToggleGroup>
            </Field>

            <Field>
              <FieldLabel>Volume (USD)</FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  inputMode="numeric"
                  placeholder="Min"
                  value={localFilters.minVolume || ""}
                  onChange={(e) => patch({ minVolume: e.target.value })}
                />
                <Input
                  inputMode="numeric"
                  placeholder="Max"
                  value={localFilters.maxVolume || ""}
                  onChange={(e) => patch({ maxVolume: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                {VOL_PRESETS.map((p) => (
                  <Button
                    key={p.value}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => patch({ minVolume: p.value })}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </Field>

            <Field>
              <FieldLabel>Liquidity (USD)</FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  inputMode="numeric"
                  placeholder="Min"
                  value={localFilters.minLiquidity || ""}
                  onChange={(e) => patch({ minLiquidity: e.target.value })}
                />
                <Input
                  inputMode="numeric"
                  placeholder="Max"
                  value={localFilters.maxLiquidity || ""}
                  onChange={(e) => patch({ maxLiquidity: e.target.value })}
                />
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Sort by</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  className="w-full"
                  value={localFilters.sortBy}
                  onValueChange={(v) =>
                    v && patch({ sortBy: v as FilterState["sortBy"] })
                  }
                >
                  <ToggleGroupItem value="endDate">Expiry</ToggleGroupItem>
                  <ToggleGroupItem value="volume">Volume</ToggleGroupItem>
                  <ToggleGroupItem value="liquidity">Liq.</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field>
                <FieldLabel>Order</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  className="w-full"
                  value={localFilters.sortOrder}
                  onValueChange={(v) =>
                    v && patch({ sortOrder: v as FilterState["sortOrder"] })
                  }
                >
                  <ToggleGroupItem value="desc">Desc</ToggleGroupItem>
                  <ToggleGroupItem value="asc">Asc</ToggleGroupItem>
                </ToggleGroup>
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button onClick={handleApply}>Apply filters</Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  );
}

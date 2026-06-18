"use client";

/**
 * Reusable shadcn data table (TanStack Table) — gives the account tables
 * client-side sorting (and an easy hook for filtering via the `data` prop).
 * Pass `SortHeader` as a column's `header` to make it sortable.
 */
import * as React from "react";
import {
  type Column,
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DataTable<TData, TValue>({
  columns,
  data,
  empty,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  empty?: React.ReactNode;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Table className="text-xs">
      <TableHeader>
        {table.getHeaderGroups().map(group => (
          <TableRow key={group.id} className="border-border hover:bg-transparent">
            {group.headers.map(header => (
              <TableHead
                key={header.id}
                className="h-9 px-4 text-[11px] font-normal text-nav-inactive"
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map(row => (
            <TableRow
              key={row.id}
              className="border-border/40 hover:bg-[#1A1D1F]/50"
            >
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id} className="px-4 py-2 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={columns.length}
              className="h-20 px-4 text-center text-nav-inactive"
            >
              {empty ?? "No data."}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/** Sortable column header — use as a column's `header`. */
export function SortHeader<TData, TValue>({
  column,
  title,
  align = "left",
}: {
  column: Column<TData, TValue>;
  title: string;
  align?: "left" | "right";
}) {
  const sorted = column.getIsSorted();
  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <div className={cn("flex", align === "right" && "justify-end")}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(sorted === "asc")}
        className="-mx-2 h-7 px-2 text-[11px] font-normal text-nav-inactive hover:text-white"
      >
        {title}
        <Icon data-icon="inline-end" className={cn(!sorted && "opacity-40")} />
      </Button>
    </div>
  );
}

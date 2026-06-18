import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function EventTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="pl-6">Market</TableHead>
        <TableHead className="text-right">Above</TableHead>
        <TableHead className="text-right">Volume</TableHead>
        <TableHead className="text-right">IV</TableHead>
        <TableHead className="text-right">Expiry</TableHead>
      </TableRow>
    </TableHeader>
  );
}

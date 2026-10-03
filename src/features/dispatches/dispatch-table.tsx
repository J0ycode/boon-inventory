"use client";

import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { StatusChip } from "@/components/shared/status-chip";
import { useTenantHref } from "@/components/shell/tenant-context";
import { formatDateTime, formatQty } from "@/lib/format";

export type DispatchRow = {
  id: string;
  number: string;
  status: string;
  created_at: string;
  dispatched_at: string | null;
  received_at: string | null;
  to: { id: string; name: string } | null;
  pieces: number;
};

const columns: DataColumn<DispatchRow>[] = [
  {
    id: "number",
    header: "Dispatch",
    meta: { mobile: "title" },
    cell: ({ row }) => (
      <>
        {row.original.number}
        <span className="block text-xs font-normal text-muted-foreground md:hidden">
          {row.original.to?.name} · {formatDateTime(row.original.dispatched_at ?? row.original.created_at)}
        </span>
      </>
    ),
  },
  { id: "to", header: "To", meta: { mobile: "hidden" }, cell: ({ row }) => row.original.to?.name },
  {
    id: "date",
    header: "Date",
    meta: { mobile: "hidden" },
    cell: ({ row }) => formatDateTime(row.original.received_at ?? row.original.dispatched_at ?? row.original.created_at),
  },
  { id: "pieces", header: "Pieces", meta: { mobile: "value", align: "right" }, cell: ({ row }) => formatQty(row.original.pieces) },
  { id: "status", header: "Status", meta: { mobile: "badge" }, cell: ({ row }) => <StatusChip status={row.original.status} /> },
];

export function DispatchTable({ rows, basePath, caption, empty }: { rows: DispatchRow[]; basePath: string; caption: string; empty: React.ReactNode }) {
  const href = useTenantHref();
  return (
    <DataTable columns={columns} data={rows} getRowId={(r) => r.id} rowHref={(r) => href(`${basePath}/${r.id}`)} caption={caption} empty={empty} />
  );
}

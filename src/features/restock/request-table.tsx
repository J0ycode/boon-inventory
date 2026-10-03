"use client";

import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { StatusChip } from "@/components/shared/status-chip";
import { useTenantHref } from "@/components/shell/tenant-context";
import { formatDateTime, formatQty } from "@/lib/format";

export type RequestRow = {
  id: string;
  number: string;
  status: string;
  source: string;
  created_at: string;
  submitted_at: string | null;
  location: { id: string; name: string } | null;
  pieces: number;
  lineCount: number;
};

export function RequestTable({
  rows,
  basePath,
  showStore,
  caption,
  empty,
}: {
  rows: RequestRow[];
  basePath: string;
  showStore: boolean;
  caption: string;
  empty: React.ReactNode;
}) {
  const href = useTenantHref();
  const columns: DataColumn<RequestRow>[] = [
    {
      id: "number",
      header: "Request",
      meta: { mobile: "title" },
      cell: ({ row }) => (
        <>
          {row.original.number}
          <span className="block text-xs font-normal text-muted-foreground">
            {[showStore ? row.original.location?.name : null, row.original.source === "SUGGESTED" ? "Suggested" : "Manual",
              formatDateTime(row.original.submitted_at ?? row.original.created_at)]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </>
      ),
    },
    { id: "lines", header: "Products", meta: { mobile: "hidden", align: "right" }, cell: ({ row }) => row.original.lineCount },
    { id: "pieces", header: "Pieces", meta: { mobile: "value", align: "right" }, cell: ({ row }) => formatQty(row.original.pieces) },
    { id: "status", header: "Status", meta: { mobile: "badge" }, cell: ({ row }) => <StatusChip status={row.original.status} /> },
  ];
  return (
    <DataTable columns={columns} data={rows} getRowId={(r) => r.id} rowHref={(r) => href(`${basePath}/${r.id}`)} caption={caption} empty={empty} />
  );
}

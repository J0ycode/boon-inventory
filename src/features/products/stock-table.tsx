"use client";

import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { StatusChip } from "@/components/shared/status-chip";
import { useTenantHref } from "@/components/shell/tenant-context";
import { CATEGORY_LABELS, formatMoney, formatQty, stockStatus } from "@/lib/format";

export type StockRow = {
  id: string;
  name: string;
  category: "CLOTHING" | "ACCESSORY";
  sku: string;
  barcode: string;
  selling_price: number;
  reorder_level: number;
  quantity: number;
  active: boolean;
  imageUrl?: string | null;
  cost?: number | null;
};

const columns = (showCost: boolean): DataColumn<StockRow>[] => [
  {
    id: "product",
    header: "Product",
    meta: { mobile: "title" },
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-3">
        <Thumb url={row.original.imageUrl} name={row.original.name} />
        <span className="min-w-0">
          <span className="line-clamp-2 md:line-clamp-1">{row.original.name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground md:hidden">
            {row.original.sku} · {formatMoney(row.original.selling_price)}
          </span>
          {!row.original.active && <span className="text-xs font-normal text-muted-foreground"> (inactive)</span>}
        </span>
      </span>
    ),
  },
  { id: "sku", header: "SKU", accessorKey: "sku", meta: { mobile: "hidden", className: "font-mono text-xs" } },
  {
    id: "category",
    header: "Category",
    meta: { mobile: "hidden" },
    cell: ({ row }) => CATEGORY_LABELS[row.original.category],
  },
  {
    id: "price",
    header: "Price",
    meta: { mobile: "hidden", align: "right" },
    cell: ({ row }) => formatMoney(row.original.selling_price),
  },
  ...(showCost
    ? [
        {
          id: "cost",
          header: "Cost",
          meta: { mobile: "hidden", align: "right" },
          cell: ({ row }) => formatMoney(row.original.cost),
        } satisfies DataColumn<StockRow>,
      ]
    : []),
  {
    id: "qty",
    header: "In stock",
    meta: { mobile: "value", align: "right" },
    cell: ({ row }) => formatQty(row.original.quantity),
  },
  {
    id: "status",
    header: "Status",
    meta: { mobile: "badge" },
    cell: ({ row }) => <StatusChip status={stockStatus(row.original.quantity, row.original.reorder_level)} />,
  },
];

function Thumb({ url, name }: { url?: string | null; name: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs; next/image would cache them
    <img src={url} alt="" className="size-10 shrink-0 rounded-lg border border-border object-cover" loading="lazy" />
  ) : (
    <span
      aria-hidden
      className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold text-muted-foreground"
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function StockTable({
  rows,
  basePath,
  showCost = false,
  caption,
  empty,
}: {
  rows: StockRow[];
  basePath: string;
  showCost?: boolean;
  caption: string;
  empty: React.ReactNode;
}) {
  const href = useTenantHref();
  return (
    <DataTable
      columns={columns(showCost)}
      data={rows}
      getRowId={(r) => r.id}
      rowHref={(r) => href(`${basePath}/${r.id}`)}
      caption={caption}
      empty={empty}
    />
  );
}

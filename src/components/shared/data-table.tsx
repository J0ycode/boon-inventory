"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  flexRender,
  tableFeatures,
  useTable,
  type CellData,
  type ColumnDef,
  type Row,
  type RowData,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * How a column appears in the phone card layout:
 * - title / subtitle: left side, stacked
 * - value: right side, emphasised (e.g. quantity)
 * - badge: right side under the value (e.g. a StatusChip)
 * - hidden: only on tablet/desktop (details are a tap away)
 */
type ColumnMeta = {
  mobile?: "title" | "subtitle" | "value" | "badge" | "hidden";
  align?: "left" | "right";
  className?: string;
};

const features = tableFeatures({ columnMeta: {} as ColumnMeta });
type Features = typeof features;

export type DataColumn<TData extends RowData, TValue extends CellData = CellData> = ColumnDef<Features, TData, TValue>;

/**
 * Data table used for every list. Data is already paginated/filtered on the server — this component only renders.
 * Tablet/desktop: a semantic table. Phone: compact stacked cards; tapping a card opens `rowHref` when given.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  rowHref,
  getRowId,
  caption,
  empty,
}: {
  columns: DataColumn<TData>[];
  data: TData[];
  rowHref?: (row: TData) => string;
  getRowId?: (row: TData) => string;
  /** Accessible name for the table (visually hidden). */
  caption: string;
  empty?: React.ReactNode;
}) {
  const table = useTable({
    features,
    columns,
    data,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });

  const rows = table.getRowModel().rows;
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <>
      {/* Phone: cards */}
      <ul className="flex flex-col gap-2 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.id}>
            <MobileCard row={row} href={rowHref?.(row.original)} />
          </li>
        ))}
      </ul>

      {/* Tablet & desktop: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-card md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-11 px-4 text-xs font-bold tracking-wide text-muted-foreground uppercase",
                        meta?.align === "right" && "text-right",
                        meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  );
                })}
                {rowHref && <TableHead className="w-10" aria-hidden />}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const href = rowHref?.(row.original);
              return (
                <TableRow key={row.id} className={cn(href && "relative cursor-pointer")}>
                  {row.getAllCells().map((cell, i) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "px-4 py-3",
                          meta?.align === "right" && "text-right tabular-nums",
                          meta?.className,
                        )}
                      >
                        {/* The first cell carries the row link so the whole row is clickable and keyboard reachable. */}
                        {href && i === 0 ? (
                          <Link href={href} className="font-semibold after:absolute after:inset-0">
                            <table.FlexRender cell={cell} />
                          </Link>
                        ) : (
                          <table.FlexRender cell={cell} />
                        )}
                      </TableCell>
                    );
                  })}
                  {href && (
                    <TableCell className="px-2 text-muted-foreground">
                      <ChevronRight className="size-4" aria-hidden />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function MobileCard<TData extends RowData>({ row, href }: { row: Row<Features, TData>; href?: string }) {
  const cells = row.getAllCells();
  const render = (c: (typeof cells)[number]) => flexRender(c.column.columnDef.cell, c.getContext());
  const pick = (slot: ColumnMeta["mobile"]) => cells.filter((c) => c.column.columnDef.meta?.mobile === slot);
  // Columns without a mobile slot: first one becomes the title.
  const title = pick("title").length ? pick("title") : cells.slice(0, 1);

  const body = (
    <div className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <div className="min-w-0 flex-1">
        {title.map((c) => (
          <div key={c.id} className="line-clamp-2 font-bold break-words">
            {render(c)}
          </div>
        ))}
        {pick("subtitle").map((c) => (
          <div key={c.id} className="truncate text-sm text-muted-foreground">
            {render(c)}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {pick("value").map((c) => (
          <div key={c.id} className="text-lg font-extrabold tabular-nums">
            {render(c)}
          </div>
        ))}
        {pick("badge").map((c) => (
          <div key={c.id}>{render(c)}</div>
        ))}
      </div>
      {href && <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
    </div>
  );

  return href ? (
    <Link href={href} className="block rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

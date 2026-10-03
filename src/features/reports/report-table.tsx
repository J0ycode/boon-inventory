import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { ReportColumn } from "./definitions";
import { formatCell } from "./format-cell";
import type { ReportRow } from "./queries";

/** Report rows: a scrollable table from md up, label/value cards on phones. */
export function ReportTable({ columns, rows, caption }: { columns: ReportColumn[]; rows: ReportRow[]; caption: string }) {
  if (rows.length === 0) {
    return <EmptyState title="No rows" description="Nothing matches these filters. Try a wider date range." />;
  }
  const [first, ...rest] = columns;
  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden" aria-label={caption}>
        {rows.map((r, i) => (
          <li key={i} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="font-bold">{formatCell(r[first!.key], first!.format, first!.key)}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {rest.map((c) => {
                const v = formatCell(r[c.key], c.format, c.key);
                return v ? (
                  <div key={c.key} className="contents">
                    <dt className="text-muted-foreground">{c.label}</dt>
                    <dd className="min-w-0 break-words tabular-nums">{v}</dd>
                  </div>
                ) : null;
              })}
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-card md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "px-3 py-2.5 text-left text-xs font-bold tracking-wide whitespace-nowrap text-muted-foreground uppercase",
                    c.align === "right" && "text-right",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 py-2.5 align-top",
                      c.align === "right" ? "text-right whitespace-nowrap tabular-nums" : "max-w-72",
                      c.format === "datetime" && "whitespace-nowrap",
                    )}
                  >
                    {formatCell(r[c.key], c.format, c.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

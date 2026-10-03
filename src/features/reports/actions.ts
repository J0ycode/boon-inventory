"use server";

import { getSession } from "@/lib/session";
import { EXPORT_LIMIT, isIsoDay, isReportKind, type ReportFilters, type ReportKind } from "./definitions";
import { runReport, type ReportRow } from "./queries";

/** Full result set (up to EXPORT_LIMIT rows) for CSV / Excel / PDF export. */
export async function fetchReportForExport(
  kind: ReportKind,
  filters: ReportFilters,
): Promise<{ ok: true; rows: ReportRow[]; truncated: boolean } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || session.role === "STORE_STAFF") return { ok: false, error: "You do not have permission to do this." };
  if (!isReportKind(kind) || !isIsoDay(filters.from) || !isIsoDay(filters.to)) return { ok: false, error: "Check the filters." };
  try {
    const { rows, total } = await runReport(kind, filters, EXPORT_LIMIT, 0);
    return { ok: true, rows, truncated: total > rows.length };
  } catch {
    return { ok: false, error: "Couldn't load the report. Try again." };
  }
}

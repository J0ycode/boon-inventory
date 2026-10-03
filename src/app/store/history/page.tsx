import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { defaultRange, isIsoDay, REPORT_PAGE_SIZE, REPORTS } from "@/features/reports/definitions";
import { runReport } from "@/features/reports/queries";
import { ReportFilters } from "@/features/reports/report-filters";
import { ReportTable } from "@/features/reports/report-table";
import { formatDate } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Stock History" };

const COLUMNS = REPORTS.movements.columns.filter((c) => c.key !== "location");

export default async function StockHistoryPage({ searchParams }: PageProps<"/store/history">) {
  await requireRole(["STORE_STAFF"]);
  const sp = await searchParams;
  const range = defaultRange();
  const from = isIsoDay(sp.from) ? sp.from : range.from;
  const to = isIsoDay(sp.to) ? sp.to : range.to;
  const type = typeof sp.type === "string" ? sp.type : undefined;
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  // RLS limits the movements report to the staff member's own store.
  const { rows, total } = await runReport("movements", { from, to, type }, REPORT_PAGE_SIZE, (page - 1) * REPORT_PAGE_SIZE);

  return (
    <>
      <PageHeader title="Stock History" description={`Every stock change in your store · ${formatDate(from)} – ${formatDate(to)}`} />
      <ReportFilters key={`${from}-${to}`} dated from={from} to={to} locations={[]} showType />
      <ReportTable columns={COLUMNS} rows={rows} caption="Stock history" />
      <Pagination page={page} pageSize={REPORT_PAGE_SIZE} total={total} />
    </>
  );
}

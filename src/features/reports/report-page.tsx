import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { formatDate } from "@/lib/format";
import type { SessionContext } from "@/lib/roles";
import { defaultRange, isIsoDay, isReportKind, REPORT_PAGE_SIZE, REPORTS, type ReportKind } from "./definitions";
import { ExportButtons } from "./export-buttons";
import { ReportFilters } from "./report-filters";
import { runReport } from "./queries";
import { ReportTable } from "./report-table";

/** Shared by /storeroom/reports and /owner/reports (the owner's view is the same, with a location filter). */
export async function ReportPage({
  session,
  searchParams,
}: {
  session: SessionContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const one = (k: string) => (typeof searchParams[k] === "string" ? (searchParams[k] as string) : undefined);
  const kind: ReportKind = isReportKind(one("report")) ? (one("report") as ReportKind) : "stock";
  const def = REPORTS[kind];
  const range = defaultRange();
  const from = isIsoDay(one("from")) ? one("from")! : range.from;
  const to = isIsoDay(one("to")) ? one("to")! : range.to;
  const locationId = session.locations.some((l) => l.id === one("location")) ? one("location") : undefined;
  const type = one("type");
  const page = Math.max(1, Number.parseInt(one("page") ?? "1", 10) || 1);
  const filters = { from, to, locationId, type };

  const { rows, total } = await runReport(kind, filters, REPORT_PAGE_SIZE, (page - 1) * REPORT_PAGE_SIZE);
  const locationName = session.locations.find((l) => l.id === locationId)?.name ?? "All locations";
  const subtitle = [locationName, def.dated ? `${formatDate(from)} – ${formatDate(to)}` : `as of ${formatDate(new Date())}`].join(" · ");

  return (
    <>
      <PageHeader
        title="Reports"
        description={subtitle}
        actions={<ExportButtons kind={kind} filters={filters} shopName={session.tenant.name} subtitle={subtitle} />}
      />
      <FilterTabs
        param="report"
        label="Report"
        options={(Object.keys(REPORTS) as ReportKind[]).map((k) => ({ value: k, label: REPORTS[k].label }))}
      />
      <ReportFilters
        key={`${from}-${to}`}
        dated={def.dated}
        from={from}
        to={to}
        locations={session.locations}
        showType={kind === "movements"}
      />
      <ReportTable columns={def.columns} rows={rows} caption={def.label} />
      <Pagination page={page} pageSize={REPORT_PAGE_SIZE} total={total} />
    </>
  );
}

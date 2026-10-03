import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText, ReceiptIndianRupee, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatCard } from "@/components/shared/stat-card";
import { StatusChip } from "@/components/shared/status-chip";
import { BILL_FILTERS, listBills, unpaidTotals, type BillFilter } from "@/features/receipts/queries";
import { BILL_STATE_LABELS, billState, todayIso } from "@/features/receipts/schemas";
import { formatDate, formatMoney } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { tenantPath } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Purchase Bills" };

const PAGE_SIZE = 25;
const FILTER_LABELS: Record<BillFilter, string> = { unpaid: "Unpaid", overdue: "Overdue", paid: "Paid", all: "All" };

export default async function BillsPage({ searchParams }: PageProps<"/storeroom/bills">) {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const sp = await searchParams;
  const filter = (BILL_FILTERS as readonly string[]).includes(sp.status as string) ? (sp.status as BillFilter) : "unpaid";
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const [{ rows, total }, totals] = await Promise.all([
    listBills(filter, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    unpaidTotals(),
  ]);
  const href = (p: string) => tenantPath(session.tenant.slug, p);
  const today = todayIso();

  return (
    <>
      <PageHeader title="Purchase Bills" description="Supplier bills from received stock: what's paid and what's due." />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="Unpaid bills"
          value={formatMoney(totals.amount)}
          hint={`${totals.count} bill${totals.count === 1 ? "" : "s"}`}
          icon={ReceiptIndianRupee}
        />
        <StatCard
          label="Overdue"
          value={formatMoney(totals.overdueAmount)}
          hint={`${totals.overdueCount} bill${totals.overdueCount === 1 ? "" : "s"} past the deadline`}
          icon={TriangleAlert}
          tone={totals.overdueCount > 0 ? "warning" : "default"}
          href={totals.overdueCount > 0 ? href("/storeroom/bills?status=overdue") : undefined}
        />
      </div>
      <FilterTabs
        param="status"
        label="Bill status"
        options={BILL_FILTERS.map((f) => ({ value: f, label: FILTER_LABELS[f] }))}
      />
      {rows.length === 0 ? (
        <EmptyState
          title={filter === "paid" || filter === "all" ? "No bills yet" : "Nothing to pay"}
          description={
            filter === "overdue" ? "No unpaid bill is past its deadline." : "Bills appear here when you receive stock."
          }
        />
      ) : (
        <Card>
          <CardContent>
            <ul className="-mx-2 divide-y divide-border">
              {rows.map((b) => {
                const state = billState(b.payment_status, b.payment_due_date, today);
                return (
                  <li key={b.id}>
                    <Link
                      href={href(`/storeroom/receive/${b.id}`)}
                      className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-3 hover:bg-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate font-semibold">{b.supplier?.name ?? "Supplier"}</span>
                          <StatusChip status={state}>{BILL_STATE_LABELS[state]}</StatusChip>
                          {b.bill_path && (
                            <FileText className="size-4 text-muted-foreground" aria-label="Bill file attached" />
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          Invoice {b.invoice_number} · {b.number} · received {formatDate(b.created_at)}
                          {b.payment_status === "UNPAID"
                            ? ` · due ${formatDate(b.payment_due_date)}`
                            : b.paid_at
                              ? ` · paid ${formatDate(b.paid_at)}`
                              : ""}
                        </span>
                      </span>
                      <span className="text-sm font-bold whitespace-nowrap tabular-nums">
                        {formatMoney(b.bill_amount)}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}

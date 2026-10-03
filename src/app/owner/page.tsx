import type { Metadata } from "next";
import { ClipboardList, TriangleAlert, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/shared/bar-chart";
import { MovementList } from "@/components/shared/movement-list";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SetupChecklist } from "@/features/dashboard/setup-checklist";
import { getLocationSummary, getNotificationSummary, recentMovements } from "@/features/dashboard/queries";
import { formatQty } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { tenantPath } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Dashboard" };

export default async function OwnerDashboard() {
  const session = await requireRole(["OWNER"]);
  const [summary, notes, activity] = await Promise.all([
    getLocationSummary(),
    getNotificationSummary(),
    recentMovements({ limit: 10 }),
  ]);
  const href = (p: string) => tenantPath(session.tenant.slug, p);
  const totalLow = summary.reduce((s, r) => s + r.low_stock, 0);

  return (
    <>
      <PageHeader title="Dashboard" description="Your Store Room and stores side by side." />
      <SetupChecklist slug={session.tenant.slug} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
        <StatCard label="Requests to decide" value={formatQty(notes.requests)} icon={ClipboardList} href={href("/storeroom/requests")} />
        <StatCard
          label="Returns & damage to approve"
          value={formatQty(notes.returns)}
          icon={Undo2}
          href={href("/storeroom/returns")}
          hint={notes.discrepancies ? `${formatQty(notes.discrepancies)} deliveries with issues` : undefined}
        />
        <StatCard
          label="Low-stock items"
          value={formatQty(totalLow)}
          icon={TriangleAlert}
          tone={totalLow ? "warning" : "default"}
          hint="Across all locations"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <BarChart
              title="Pieces in stock by location"
              unit="pieces"
              data={summary.map((r) => ({
                id: r.location_id,
                label: r.name,
                value: r.pieces,
                detail: `${formatQty(r.low_stock)} low, ${formatQty(r.out_of_stock)} out of stock`,
              }))}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Stock by location</caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 pr-3 text-right">Pieces</th>
                    <th className="py-2 pr-3 text-right">Products</th>
                    <th className="py-2 pr-3 text-right">Low</th>
                    <th className="py-2 text-right">Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {summary.map((r) => (
                    <tr key={r.location_id}>
                      <th scope="row" className="py-2.5 pr-3 text-left font-semibold">
                        {r.name}
                      </th>
                      <td className="py-2.5 pr-3 text-right">{formatQty(r.pieces)}</td>
                      <td className="py-2.5 pr-3 text-right">{formatQty(r.products_in_stock)}</td>
                      <td className="py-2.5 pr-3 text-right">{formatQty(r.low_stock)}</td>
                      <td className="py-2.5 text-right">{formatQty(r.out_of_stock)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <MovementList items={activity} showLocation />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

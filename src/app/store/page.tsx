import type { Metadata } from "next";
import { Boxes, ClipboardList, Inbox, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { MovementList } from "@/components/shared/movement-list";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getLocationSummary, getNotificationSummary, recentMovements } from "@/features/dashboard/queries";
import { countRequests } from "@/features/restock/queries";
import { formatQty } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { storesOf } from "@/lib/roles";
import { tenantPath } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Dashboard" };

export default async function StoreDashboard() {
  const session = await requireRole(["STORE_STAFF"]);
  const store = storesOf(session)[0];
  if (!store) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState title="No store assigned" description="Ask the owner to assign you to a store." />
      </>
    );
  }
  const [summary, notes, openRequests, activity] = await Promise.all([
    getLocationSummary(),
    getNotificationSummary(),
    countRequests(["SENT", "APPROVED"], store.id),
    recentMovements({ locationId: store.id, limit: 12 }),
  ]);
  const row = summary.find((s) => s.location_id === store.id);
  const href = (p: string) => tenantPath(session.tenant.slug, p);

  return (
    <>
      <PageHeader title="Dashboard" description={`Today at ${store.name}.`} />
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard label="Pieces in store" value={formatQty(row?.pieces)} icon={Boxes} href={href("/store/stock")} />
        <StatCard
          label="Low stock"
          value={formatQty(notes.low_stock)}
          icon={TriangleAlert}
          tone={notes.low_stock ? "warning" : "default"}
          href={href("/store/stock?stock=low")}
          hint={notes.suggestions ? "Suggestions are waiting for you" : "At or below reorder level"}
        />
        <StatCard label="Deliveries to confirm" value={formatQty(notes.incoming)} icon={Inbox} href={href("/store/incoming")} />
        <StatCard label="Open requests" value={formatQty(openRequests)} icon={ClipboardList} href={href("/store/requests")} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <MovementList items={activity} />
        </CardContent>
      </Card>
    </>
  );
}

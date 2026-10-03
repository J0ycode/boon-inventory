import type { Metadata } from "next";
import { Boxes, ClipboardList, Package, TriangleAlert, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MovementList } from "@/components/shared/movement-list";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { countActiveProducts, getLocationSummary, getNotificationSummary, recentMovements } from "@/features/dashboard/queries";
import { formatQty } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { storeRoomOf } from "@/lib/roles";
import { tenantPath } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Store Room" };

export default async function StoreRoomDashboard() {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const room = storeRoomOf(session)!;
  const [products, summary, notes, activity] = await Promise.all([
    countActiveProducts(),
    getLocationSummary(),
    getNotificationSummary(),
    recentMovements({ limit: 12 }),
  ]);
  const roomRow = summary.find((s) => s.location_id === room.id);
  const href = (p: string) => tenantPath(session.tenant.slug, p);
  const approvals = (notes.returns ?? 0) + (notes.discrepancies ?? 0);

  return (
    <>
      <PageHeader title="Dashboard" description="Today in the Store Room." />
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-5">
        <StatCard label="Products" value={formatQty(products)} icon={Package} href={href("/storeroom/products")} />
        <StatCard label="Pieces in Store Room" value={formatQty(roomRow?.pieces)} icon={Boxes} />
        <StatCard
          label="Low stock"
          value={formatQty(notes.low_stock)}
          icon={TriangleAlert}
          tone={notes.low_stock ? "warning" : "default"}
          href={href("/storeroom/products?stock=low")}
          hint="At or below reorder level"
        />
        <StatCard label="Requests to decide" value={formatQty(notes.requests)} icon={ClipboardList} href={href("/storeroom/requests")} />
        <StatCard
          label="Approvals & issues"
          value={formatQty(approvals)}
          icon={Undo2}
          href={href("/storeroom/returns")}
          hint="Returns, damage, delivery issues"
        />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <MovementList items={activity} showLocation />
        </CardContent>
      </Card>
    </>
  );
}

import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { countRequests, listRequests, type RestockStatus } from "@/features/restock/queries";
import { RequestTable } from "@/features/restock/request-table";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Restock Requests" };

const VIEWS: Record<string, RestockStatus[]> = {
  sent: ["SENT"],
  approved: ["APPROVED", "DISPATCHED"],
  rejected: ["REJECTED"],
};

export default async function StoreRoomRequestsPage({ searchParams }: PageProps<"/storeroom/requests">) {
  await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const show = (await searchParams).show;
  const view = typeof show === "string" && show in VIEWS ? show : "sent";
  const [rows, toDecide] = await Promise.all([listRequests({ statuses: VIEWS[view]! }), countRequests(["SENT"])]);

  return (
    <>
      <PageHeader title="Restock Requests" description="Requests from your stores. Approving one prepares a dispatch." />
      <FilterTabs
        param="show"
        label="Request status"
        options={[
          { value: "sent", label: "To decide", count: toDecide },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
        ]}
      />
      <RequestTable
        rows={rows}
        basePath="/storeroom/requests"
        showStore
        caption="Restock requests from stores"
        empty={<EmptyState icon={ClipboardList} title={view === "sent" ? "No requests waiting" : "Nothing here yet"} />}
      />
    </>
  );
}

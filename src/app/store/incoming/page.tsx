import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DispatchTable } from "@/features/dispatches/dispatch-table";
import { listDispatches } from "@/features/dispatches/queries";
import { requireRole } from "@/lib/session";
import { storesOf } from "@/lib/roles";

export const metadata: Metadata = { title: "Incoming Dispatches" };

export default async function IncomingPage({ searchParams }: PageProps<"/store/incoming">) {
  const session = await requireRole(["STORE_STAFF"]);
  const store = storesOf(session)[0];
  const done = (await searchParams).show === "done";
  const rows = store
    ? done
      ? (await listDispatches({ toLocationId: store.id, limit: 50 })).filter((d) => d.status !== "DISPATCHED")
      : await listDispatches({ toLocationId: store.id, filter: "active" })
    : [];
  const waiting = done ? undefined : rows.length;

  return (
    <>
      <PageHeader title="Incoming Dispatches" description="Check deliveries from the Store Room and confirm what arrived." />
      <FilterTabs
        param="show"
        label="Delivery status"
        options={[
          { value: "waiting", label: "To confirm", count: waiting },
          { value: "done", label: "Confirmed" },
        ]}
      />
      <DispatchTable
        rows={rows}
        basePath="/store/incoming"
        caption="Deliveries to your store"
        empty={
          <EmptyState
            icon={Inbox}
            title={done ? "No confirmed deliveries yet" : "Nothing to confirm"}
            description={done ? undefined : "Deliveries from the Store Room appear here as soon as they are sent."}
          />
        }
      />
    </>
  );
}

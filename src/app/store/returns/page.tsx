import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { EntryForm } from "@/features/returns/entry-form";
import { EntryList } from "@/features/returns/entry-list";
import { listEntries } from "@/features/returns/queries";
import { requireRole } from "@/lib/session";
import { storesOf } from "@/lib/roles";

export const metadata: Metadata = { title: "Return or Report Damaged" };

export default async function StoreReturnsPage() {
  const session = await requireRole(["STORE_STAFF"]);
  const store = storesOf(session)[0];
  if (!store) return <EmptyState title="No store assigned" description="Ask the owner to assign you to a store." />;
  const entries = await listEntries({ locationId: store.id, limit: 30 });

  return (
    <>
      <PageHeader title="Return or Report Damaged" description="The Store Room approves each entry before stock changes." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        <EntryForm locationId={store.id} stockLabel="in your store" types={["RETURN_TO_STOREROOM", "DAMAGE"]} applyImmediately={false} />
        <section aria-labelledby="my-entries">
          <h2 id="my-entries" className="mb-3 text-lg font-bold">
            Your entries
          </h2>
          <EntryList items={entries} canDecide={false} showLocation={false} />
        </section>
      </div>
    </>
  );
}

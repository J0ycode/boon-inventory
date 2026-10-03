import type { Metadata } from "next";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DiscrepancyList } from "@/features/dispatches/discrepancy-list";
import { listOpenDiscrepancies } from "@/features/dispatches/queries";
import { EntryForm } from "@/features/returns/entry-form";
import { EntryList } from "@/features/returns/entry-list";
import { listEntries } from "@/features/returns/queries";
import { requireRole } from "@/lib/session";
import { storeRoomOf } from "@/lib/roles";

export const metadata: Metadata = { title: "Returns & Damaged" };

export default async function ReturnsPage({ searchParams }: PageProps<"/storeroom/returns">) {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const show = (await searchParams).show;
  const view = show === "issues" || show === "record" || show === "history" ? show : "pending";
  const [pending, discrepancies] = await Promise.all([listEntries({ status: "PENDING" }), listOpenDiscrepancies()]);
  const history = view === "history" ? await listEntries({ status: "DONE" }) : [];
  const room = storeRoomOf(session)!;

  return (
    <>
      <PageHeader title="Returns & Damaged" description="Approve store returns and write-offs, and settle delivery issues." />
      <FilterTabs
        param="show"
        label="Returns view"
        options={[
          { value: "pending", label: "To approve", count: pending.length },
          { value: "issues", label: "Delivery issues", count: discrepancies.length },
          { value: "record", label: "Record at Store Room" },
          { value: "history", label: "History" },
        ]}
      />
      {view === "pending" && <EntryList items={pending} canDecide showLocation />}
      {view === "issues" && <DiscrepancyList items={discrepancies} />}
      {view === "record" && (
        <div className="max-w-xl">
          <EntryForm locationId={room.id} stockLabel="in Store Room" types={["DAMAGE", "SUPPLIER_RETURN"]} applyImmediately />
        </div>
      )}
      {view === "history" && <EntryList items={history} canDecide={false} showLocation />}
    </>
  );
}

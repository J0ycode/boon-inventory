import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { listRequests } from "@/features/restock/queries";
import { RequestTable } from "@/features/restock/request-table";
import { SuggestButton } from "@/features/restock/suggest-button";
import { requireRole } from "@/lib/session";
import { storesOf } from "@/lib/roles";
import { tenantPath } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Request Restock" };

export default async function StoreRequestsPage({ searchParams }: PageProps<"/store/requests">) {
  const session = await requireRole(["STORE_STAFF"]);
  const store = storesOf(session)[0];
  if (!store) return <EmptyState title="No store assigned" description="Ask the owner to assign you to a store." />;
  const history = (await searchParams).show === "history";
  const href = (p: string) => tenantPath(session.tenant.slug, p);

  const [waiting, rows] = await Promise.all([
    listRequests({ statuses: ["WAITING_STAFF_APPROVAL"], locationId: store.id }),
    listRequests({
      statuses: history ? ["DISPATCHED", "REJECTED"] : ["DRAFT", "SENT", "APPROVED"],
      locationId: store.id,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Request Restock"
        description={`Ask the Store Room for more stock for ${store.name}.`}
        actions={
          <>
            <SuggestButton locationId={store.id} />
            <Button asChild>
              <Link href={href("/store/requests/new")}>
                <Plus aria-hidden /> New request
              </Link>
            </Button>
          </>
        }
      />

      {waiting.map((w) => (
        <Link
          key={w.id}
          href={href(`/store/requests/${w.id}`)}
          className="mb-4 flex items-center gap-3 rounded-xl border border-lavender-foreground/30 bg-lavender p-4 text-lavender-foreground"
        >
          <Sparkles className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{w.lineCount} suggested items are waiting for your approval</span>
            <span className="block text-sm">Approve, edit, or skip each one, then forward to the Store Room.</span>
          </span>
          <span className="font-semibold underline">Review</span>
        </Link>
      ))}

      <FilterTabs
        param="show"
        label="Request status"
        options={[
          { value: "open", label: "Open" },
          { value: "history", label: "History" },
        ]}
      />
      <RequestTable
        rows={rows}
        basePath="/store/requests"
        showStore={false}
        caption="Restock requests"
        empty={
          <EmptyState
            icon={ClipboardList}
            title={history ? "No past requests" : "No open requests"}
            description={history ? undefined : "Create a request, or let the app suggest items at or below their reorder level."}
          />
        }
      />
    </>
  );
}

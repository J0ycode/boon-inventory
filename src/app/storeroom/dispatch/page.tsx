import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DispatchTable } from "@/features/dispatches/dispatch-table";
import { countDispatches, listDispatches, type DispatchFilter } from "@/features/dispatches/queries";
import { requireRole } from "@/lib/session";
import { tenantPath } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Dispatch" };

export default async function DispatchListPage({ searchParams }: PageProps<"/storeroom/dispatch">) {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const sp = await searchParams;
  const filter: DispatchFilter = sp.show === "issues" || sp.show === "done" ? sp.show : "active";
  const [rows, issueCount] = await Promise.all([listDispatches({ filter }), countDispatches(["RECEIVED_WITH_ISSUES"])]);
  const newHref = tenantPath(session.tenant.slug, "/storeroom/dispatch/new");

  return (
    <>
      <PageHeader
        title="Dispatch"
        description="Send stock from the Store Room to your stores."
        actions={
          <Button asChild>
            <Link href={newHref}>
              <Plus aria-hidden /> New dispatch
            </Link>
          </Button>
        }
      />
      <FilterTabs
        param="show"
        label="Dispatch status"
        options={[
          { value: "active", label: "Drafts & in transit" },
          { value: "issues", label: "With issues", count: issueCount },
          { value: "done", label: "Completed" },
        ]}
      />
      <DispatchTable
        rows={rows}
        basePath="/storeroom/dispatch"
        caption="Dispatches"
        empty={
          <EmptyState
            icon={Truck}
            title={filter === "active" ? "Nothing in progress" : filter === "issues" ? "No deliveries with issues" : "No completed dispatches yet"}
            description={filter === "active" ? "Create a dispatch to send stock to a store." : undefined}
            action={
              filter === "active" ? (
                <Button asChild>
                  <Link href={newHref}>
                    <Plus aria-hidden /> New dispatch
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      />
    </>
  );
}

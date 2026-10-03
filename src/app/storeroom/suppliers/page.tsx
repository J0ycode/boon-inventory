import type { Metadata } from "next";
import { Pencil, Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { SupplierDialog } from "@/features/products/supplier-dialog";
import { listSuppliers } from "@/features/products/queries";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const suppliers = await listSuppliers({ includeInactive: true });
  const addButton = (
    <SupplierDialog
      trigger={
        <Button>
          <Plus aria-hidden /> Add supplier
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader title="Suppliers" description="Who you buy stock from." actions={suppliers.length > 0 && addButton} />
      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers yet"
          description="Add the suppliers you receive stock from."
          action={addButton}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((s) => (
            <li key={s.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {s.name} {!s.active && <StatusChip tone="neutral">Inactive</StatusChip>}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {[s.phone, s.email].filter(Boolean).join(" · ") || "No contact details"}
                </p>
                {s.address && <p className="truncate text-sm text-muted-foreground">{s.address}</p>}
              </div>
              <SupplierDialog
                initial={{
                  id: s.id,
                  name: s.name,
                  phone: s.phone ?? "",
                  email: s.email ?? "",
                  address: s.address ?? "",
                  active: s.active,
                }}
                trigger={
                  <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`}>
                    <Pencil aria-hidden />
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

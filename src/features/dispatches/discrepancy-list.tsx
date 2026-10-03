"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useTenantHref } from "@/components/shell/tenant-context";
import { formatDateTime, formatQty } from "@/lib/format";
import { CircleCheck } from "lucide-react";
import { resolveDiscrepancy } from "./actions";

export type Discrepancy = {
  id: string;
  quantity_missing: number;
  quantity_damaged: number;
  issue_note: string | null;
  product: { name: string; sku: string } | null;
  dispatch: { id: string; number: string; received_at: string | null; to: { name: string } | null };
};

/** Store Room view of deliveries that arrived short or damaged, with the two resolutions. */
export function DiscrepancyList({ items }: { items: Discrepancy[] }) {
  const router = useRouter();
  const href = useTenantHref();

  if (items.length === 0) {
    return <EmptyState icon={CircleCheck} title="No open discrepancies" description="Every delivery arrived as sent." />;
  }

  const resolve = async (id: string, resolution: "RETURN_TO_STOCK" | "WRITE_OFF") => {
    const result = await resolveDiscrepancy(id, resolution, "", crypto.randomUUID());
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(resolution === "WRITE_OFF" ? "Written off" : "Returned to Store Room stock");
    router.refresh();
  };

  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {items.map((d) => {
        const qty = d.quantity_missing + d.quantity_damaged;
        return (
          <li key={d.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="min-w-0">
              <p className="font-bold">{d.product?.name}</p>
              <p className="text-sm text-muted-foreground">
                <Link href={href(`/storeroom/dispatch/${d.dispatch.id}`)} className="font-semibold text-primary underline-offset-2 hover:underline">
                  {d.dispatch.number}
                </Link>{" "}
                to {d.dispatch.to?.name} · {formatDateTime(d.dispatch.received_at)}
              </p>
              <p className="mt-2 text-sm">
                {d.quantity_missing > 0 && <strong>{formatQty(d.quantity_missing)} missing</strong>}
                {d.quantity_missing > 0 && d.quantity_damaged > 0 && " · "}
                {d.quantity_damaged > 0 && <strong>{formatQty(d.quantity_damaged)} damaged</strong>}
                {d.issue_note && <span className="text-muted-foreground"> — “{d.issue_note}”</span>}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ConfirmDialog
                title={`Return ${formatQty(qty)} to Store Room stock?`}
                description="Use this when the pieces were found or are fit to sell. They are added back to the Store Room."
                confirmLabel="Return to stock"
                onConfirm={() => resolve(d.id, "RETURN_TO_STOCK")}
                trigger={<Button variant="outline">Return to stock</Button>}
              />
              <ConfirmDialog
                destructive
                title={`Write off ${formatQty(qty)} pieces?`}
                description="Use this when the pieces are lost or unsellable. The loss is recorded in the stock history."
                confirmLabel="Write off"
                onConfirm={() => resolve(d.id, "WRITE_OFF")}
                trigger={<Button variant="destructive">Write off</Button>}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { listSuppliers } from "@/features/products/queries";
import { ReceiveForm } from "@/features/receipts/receive-form";
import { listRecentReceipts } from "@/features/receipts/queries";
import { formatDateTime, formatQty } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { storeRoomOf } from "@/lib/roles";
import { tenantPath } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Receive Stock" };

export default async function ReceivePage() {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const [suppliers, recent] = await Promise.all([listSuppliers(), listRecentReceipts(8)]);
  const href = (p: string) => tenantPath(session.tenant.slug, p);

  return (
    <>
      <PageHeader title="Receive Stock" description="Record a supplier delivery. Stock is added to the Store Room." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ReceiveForm storeRoomId={storeRoomOf(session)!.id} tenantId={session.tenant.id} suppliers={suppliers} />
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Recent receipts</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing received yet.</p>
            ) : (
              <ul className="-mx-2">
                {recent.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={href(`/storeroom/receive/${r.id}`)}
                      className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {r.number} · {r.supplier?.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          Invoice {r.invoice_number} · {formatDateTime(r.created_at)}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular-nums">{formatQty(r.pieces)}</span>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

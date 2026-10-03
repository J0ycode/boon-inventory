import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { DispatchLines } from "@/features/dispatches/dispatch-lines";
import { DispatchNoteButton } from "@/features/dispatches/dispatch-note-button";
import { getDispatch } from "@/features/dispatches/queries";
import { ReceiveDispatchForm } from "@/features/dispatches/receive-dispatch-form";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Delivery" };

export default async function IncomingDispatchPage({ params }: PageProps<"/store/incoming/[id]">) {
  const session = await requireRole(["STORE_STAFF"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const dispatch = await getDispatch(id); // RLS: only deliveries to this staff member's store
  if (!dispatch) notFound();

  const noteData = {
    shopName: session.tenant.name,
    number: dispatch.number,
    status: dispatch.status,
    from: dispatch.from?.name ?? "Store Room",
    to: dispatch.to?.name ?? "",
    createdAt: dispatch.created_at,
    dispatchedAt: dispatch.dispatched_at,
    note: dispatch.note,
    lines: dispatch.dispatch_lines.map((l) => ({
      name: l.product?.name ?? "",
      sku: l.product?.sku ?? "",
      barcode: l.product?.barcode ?? "",
      sent: l.quantity_sent,
      received: l.quantity_received,
    })),
  };

  return (
    <>
      <PageHeader
        title={`Delivery ${dispatch.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip status={dispatch.status === "DISPATCHED" ? "PENDING" : dispatch.status}>
              {dispatch.status === "DISPATCHED" ? "To confirm" : undefined}
            </StatusChip>
            Sent {formatDateTime(dispatch.dispatched_at)}
          </span>
        }
        actions={<DispatchNoteButton data={noteData} />}
      />
      {dispatch.note && <p className="mb-4 text-sm">Note from the Store Room: {dispatch.note}</p>}
      {dispatch.status === "DISPATCHED" ? (
        <ReceiveDispatchForm
          dispatchId={dispatch.id}
          lines={dispatch.dispatch_lines.map((l) => ({
            id: l.id,
            name: l.product?.name ?? "",
            sku: l.product?.sku ?? "",
            sent: l.quantity_sent,
          }))}
        />
      ) : (
        <DispatchLines dispatch={dispatch} />
      )}
    </>
  );
}

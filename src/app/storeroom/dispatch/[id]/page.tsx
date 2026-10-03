import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { DispatchEditor } from "@/features/dispatches/dispatch-editor";
import { DispatchLines } from "@/features/dispatches/dispatch-lines";
import { DispatchNoteButton } from "@/features/dispatches/dispatch-note-button";
import { availableAt, getDispatch } from "@/features/dispatches/queries";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { storeRoomOf, storesOf } from "@/lib/roles";

export const metadata: Metadata = { title: "Dispatch" };

export default async function DispatchPage({ params }: PageProps<"/storeroom/dispatch/[id]">) {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const dispatch = await getDispatch(id);
  if (!dispatch) notFound();
  const room = storeRoomOf(session)!;

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

  if (dispatch.status === "DRAFT") {
    const available = await availableAt(room.id, dispatch.dispatch_lines.map((l) => l.product!.id));
    return (
      <>
        <PageHeader
          title={`Dispatch ${dispatch.number}`}
          description={<StatusChip status="DRAFT" />}
          actions={<DispatchNoteButton data={noteData} />}
        />
        <DispatchEditor
          storeRoomId={room.id}
          stores={storesOf(session)}
          initial={{
            id: dispatch.id,
            number: dispatch.number,
            toLocationId: dispatch.to!.id,
            note: dispatch.note ?? "",
            lines: dispatch.dispatch_lines.map((l) => ({
              product_id: l.product!.id,
              name: l.product!.name,
              sku: l.product!.sku,
              quantity: l.quantity_sent,
              available: available.get(l.product!.id) ?? 0,
            })),
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Dispatch ${dispatch.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip status={dispatch.status} />
            To {dispatch.to?.name} · sent {formatDateTime(dispatch.dispatched_at)}
            {dispatch.received_at && ` · confirmed ${formatDateTime(dispatch.received_at)}`}
            {dispatch.receiver && ` by ${dispatch.receiver.full_name}`}
          </span>
        }
        actions={<DispatchNoteButton data={noteData} />}
      />
      {dispatch.note && <p className="mb-4 text-sm">Note: {dispatch.note}</p>}
      <DispatchLines dispatch={dispatch} />
    </>
  );
}

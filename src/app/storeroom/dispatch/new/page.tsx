import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { DispatchEditor } from "@/features/dispatches/dispatch-editor";
import { requireRole } from "@/lib/session";
import { storeRoomOf, storesOf } from "@/lib/roles";

export const metadata: Metadata = { title: "New dispatch" };

export default async function NewDispatchPage() {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  return (
    <>
      <PageHeader title="New dispatch" description="Pick a store and the products to send. Stock moves when you press Send." />
      <DispatchEditor storeRoomId={storeRoomOf(session)!.id} stores={storesOf(session)} />
    </>
  );
}

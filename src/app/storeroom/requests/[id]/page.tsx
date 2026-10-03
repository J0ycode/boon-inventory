import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { DecisionPanel } from "@/features/restock/decision-panel";
import { getRequest } from "@/features/restock/queries";
import { RequestLines } from "@/features/restock/request-view";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { tenantPath } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Restock request" };

export default async function StoreRoomRequestPage({ params }: PageProps<"/storeroom/requests/[id]">) {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const request = await getRequest(id);
  if (!request) notFound();
  const dispatch = request.dispatches[0];

  return (
    <>
      <PageHeader
        title={`Request ${request.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip status={request.status} />
            {request.location?.name} · {request.source === "SUGGESTED" ? "Suggested, approved by staff" : "Manual"} ·{" "}
            {formatDateTime(request.submitted_at)}
            {request.creator && ` · ${request.creator.full_name}`}
          </span>
        }
      />
      {request.note && <p className="mb-4 text-sm">Note from the store: {request.note}</p>}
      {request.decision_note && <p className="mb-4 text-sm">Decision note: {request.decision_note}</p>}
      {dispatch && (
        <p className="mb-4 text-sm">
          Dispatch{" "}
          <Link href={tenantPath(session.tenant.slug, `/storeroom/dispatch/${dispatch.id}`)} className="font-semibold text-primary underline">
            {dispatch.number}
          </Link>{" "}
          <StatusChip status={dispatch.status} />
        </p>
      )}
      <RequestLines request={request} />
      {request.status === "SENT" && <DecisionPanel requestId={request.id} storeName={request.location?.name ?? "The store"} />}
    </>
  );
}

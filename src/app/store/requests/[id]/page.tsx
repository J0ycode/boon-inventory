import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { getRequest } from "@/features/restock/queries";
import { RequestEditor } from "@/features/restock/request-editor";
import { RequestLines } from "@/features/restock/request-view";
import { SuggestionReview } from "@/features/restock/suggestion-review";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { tenantPath } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Restock request" };

export default async function StoreRequestPage({ params }: PageProps<"/store/requests/[id]">) {
  const session = await requireRole(["STORE_STAFF"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const request = await getRequest(id);
  if (!request) notFound();

  const dispatch = request.dispatches[0];
  const header = (
    <PageHeader
      title={`Request ${request.number}`}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <StatusChip status={request.status} />
          {request.source === "SUGGESTED" ? "Suggested" : "Manual"} · {formatDateTime(request.submitted_at ?? request.created_at)}
        </span>
      }
    />
  );

  if (request.status === "DRAFT") {
    return (
      <>
        {header}
        <RequestEditor
          locationId={request.location!.id}
          initial={{
            id: request.id,
            note: request.note ?? "",
            lines: request.restock_request_lines.map((l) => ({
              product_id: l.product!.id,
              name: l.product!.name,
              sku: l.product!.sku,
              quantity: l.quantity,
            })),
          }}
        />
      </>
    );
  }

  if (request.status === "WAITING_STAFF_APPROVAL") {
    return (
      <>
        {header}
        <SuggestionReview
          requestId={request.id}
          lines={request.restock_request_lines.map((l) => ({
            id: l.id,
            name: l.product?.name ?? "",
            sku: l.product?.sku ?? "",
            quantity: l.quantity,
            suggested: l.suggested_quantity,
            reorderLevel: l.product?.reorder_level ?? 0,
            status: l.line_status,
          }))}
        />
      </>
    );
  }

  return (
    <>
      {header}
      {request.status === "REJECTED" && request.decision_note && (
        <p className="mb-4 rounded-xl bg-danger px-4 py-3 text-sm text-danger-foreground">
          <strong>Rejected:</strong> {request.decision_note}
        </p>
      )}
      {dispatch && dispatch.status !== "DRAFT" && (
        <p className="mb-4 text-sm">
          Sent as{" "}
          <Link href={tenantPath(session.tenant.slug, `/store/incoming/${dispatch.id}`)} className="font-semibold text-primary underline">
            {dispatch.number}
          </Link>
          .
        </p>
      )}
      {request.note && <p className="mb-4 text-sm">Note: {request.note}</p>}
      <RequestLines request={request} />
    </>
  );
}

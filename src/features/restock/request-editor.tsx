"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form-fields";
import { StickyActionBar } from "@/components/shared/page-header";
import { useTenantHref } from "@/components/shell/tenant-context";
import { addLine, LineEditor, totalPieces, type DocLine } from "@/features/products/line-editor";
import { ProductPicker } from "@/features/products/product-picker";
import { useIdempotencyKey } from "@/lib/idempotency";
import { formatQty } from "@/lib/format";
import { deleteRequest, saveRequest } from "./actions";

/** Store staff build a manual restock request. Stock shown is the store's own. */
export function RequestEditor({
  locationId,
  initial,
}: {
  locationId: string;
  initial?: { id: string; note: string; lines: DocLine[] };
}) {
  const router = useRouter();
  const href = useTenantHref();
  const [key, renewKey] = useIdempotencyKey();
  const [lines, setLines] = useState<DocLine[]>(initial?.lines ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (send: boolean) => {
    setError(undefined);
    setBusy(true);
    const result = await saveRequest({
      id: initial?.id ?? null,
      locationId,
      note,
      send,
      idempotencyKey: key,
      lines: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    renewKey();
    toast.success(send ? `${result.data.number} sent to the Store Room` : "Draft saved");
    router.push(href(send ? "/store/requests" : `/store/requests/${result.data.id}`));
    router.refresh();
    return true;
  };

  return (
    <div className="flex flex-col gap-5">
      <FormError message={error} />
      <div className="flex flex-col gap-3">
        <ProductPicker
          locationId={locationId}
          stockLabel="in your store"
          onAdd={(p, qty) => setLines((ls) => addLine(ls, { product_id: p.id, name: p.name, sku: p.sku, quantity: qty }))}
        />
        <LineEditor lines={lines} onChange={setLines} />
      </div>
      <Field>
        <FieldLabel htmlFor="request-note">Note for the Store Room (optional)</FieldLabel>
        <Input id="request-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoComplete="off" />
      </Field>
      <StickyActionBar>
        {initial && (
          <ConfirmDialog
            destructive
            title="Delete this draft?"
            description="The request is removed. Nothing has been sent."
            confirmLabel="Delete draft"
            onConfirm={async () => {
              const result = await deleteRequest(initial.id);
              if (!result.ok) {
                toast.error(result.error);
                return false;
              }
              router.push(href("/store/requests"));
            }}
            trigger={
              <Button type="button" variant="ghost">
                <Trash2 aria-hidden /> Delete
              </Button>
            }
          />
        )}
        <Button type="button" variant="outline" disabled={busy || lines.length === 0} onClick={() => submit(false)}>
          <Save aria-hidden /> Save draft
        </Button>
        <ConfirmDialog
          title={`Send request for ${formatQty(totalPieces(lines))} pieces?`}
          description="The Store Room will approve it and prepare a dispatch, or tell you why not."
          confirmLabel="Send request"
          onConfirm={() => submit(true)}
          trigger={
            <Button type="button" disabled={busy || lines.length === 0}>
              <Send aria-hidden /> Send to Store Room
            </Button>
          }
        />
      </StickyActionBar>
    </div>
  );
}

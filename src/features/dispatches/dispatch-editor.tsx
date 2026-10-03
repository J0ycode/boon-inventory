"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form-fields";
import { StickyActionBar } from "@/components/shared/page-header";
import { useTenantHref } from "@/components/shell/tenant-context";
import { addLine, LineEditor, totalPieces, type DocLine } from "@/features/products/line-editor";
import { ProductPicker } from "@/features/products/product-picker";
import { useIdempotencyKey } from "@/lib/idempotency";
import { formatQty } from "@/lib/format";
import { deleteDispatchDraft, saveDispatchDraft, sendDispatch } from "./actions";

export function DispatchEditor({
  storeRoomId,
  stores,
  initial,
}: {
  storeRoomId: string;
  stores: { id: string; name: string }[];
  initial?: { id: string; number: string; toLocationId: string; note: string; lines: DocLine[] };
}) {
  const router = useRouter();
  const href = useTenantHref();
  const [key, renewKey] = useIdempotencyKey();
  const [id, setId] = useState(initial?.id ?? null);
  const [toLocationId, setTo] = useState(initial?.toLocationId ?? (stores.length === 1 ? stores[0]!.id : ""));
  const [note, setNote] = useState(initial?.note ?? "");
  const [lines, setLines] = useState<DocLine[]>(initial?.lines ?? []);
  const [error, setError] = useState<string>();
  const [saving, startSave] = useTransition();

  const pieces = totalPieces(lines);
  const short = lines.filter((l) => l.available !== undefined && l.quantity > l.available);
  const storeName = stores.find((s) => s.id === toLocationId)?.name;

  const save = async () => {
    setError(undefined);
    const result = await saveDispatchDraft({
      id,
      toLocationId,
      note,
      lines: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
    });
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setId(result.data.id);
    return result.data.id;
  };

  return (
    <div className="flex flex-col gap-5">
      <FormError message={error} />
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="dispatch-to">Send to</FieldLabel>
          <Select value={toLocationId || undefined} onValueChange={setTo}>
            <SelectTrigger id="dispatch-to" className="w-full">
              <SelectValue placeholder="Choose a store" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="dispatch-note">Note (optional)</FieldLabel>
          <Input id="dispatch-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoComplete="off" />
        </Field>
      </FieldGroup>

      <div className="flex flex-col gap-3">
        <ProductPicker
          locationId={storeRoomId}
          stockLabel="in Store Room"
          onAdd={(p, qty) =>
            setLines((ls) =>
              addLine(ls, { product_id: p.id, name: p.name, sku: p.sku, quantity: qty, available: p.quantity }),
            )
          }
        />
        <LineEditor lines={lines} onChange={setLines} limitToAvailable />
      </div>

      <StickyActionBar>
        {id && (
          <ConfirmDialog
            destructive
            title="Delete this draft?"
            description="The draft and its lines are removed. Stock is not affected."
            confirmLabel="Delete draft"
            onConfirm={async () => {
              const result = await deleteDispatchDraft(id);
              if (!result.ok) {
                toast.error(result.error);
                return false;
              }
              toast.success("Draft deleted");
              router.push(href("/storeroom/dispatch"));
            }}
            trigger={
              <Button type="button" variant="ghost">
                <Trash2 aria-hidden /> Delete
              </Button>
            }
          />
        )}
        <Button
          type="button"
          variant="outline"
          disabled={saving || !toLocationId || lines.length === 0}
          onClick={() =>
            startSave(async () => {
              const saved = await save();
              if (saved) {
                toast.success("Draft saved");
                router.replace(href(`/storeroom/dispatch/${saved}`));
              }
            })
          }
        >
          <Save aria-hidden /> Save draft
        </Button>
        <ConfirmDialog
          title={`Send ${formatQty(pieces)} pieces to ${storeName ?? "the store"}?`}
          description="Store Room stock is deducted now. The store confirms what arrives."
          confirmLabel="Send dispatch"
          onConfirm={async () => {
            const saved = await save();
            if (!saved) return false;
            const result = await sendDispatch(saved, key);
            if (!result.ok) {
              setError(result.error);
              return false;
            }
            renewKey();
            toast.success(`${result.data.number} sent: ${formatQty(result.data.pieces)} pieces in transit`);
            router.replace(href(`/storeroom/dispatch/${saved}`));
            router.refresh();
          }}
          trigger={
            <Button type="button" disabled={!toLocationId || lines.length === 0 || short.length > 0}>
              <Send aria-hidden /> {short.length > 0 ? "Not enough stock" : "Send"}
            </Button>
          }
        />
      </StickyActionBar>
    </div>
  );
}

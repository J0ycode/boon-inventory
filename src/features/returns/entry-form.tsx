"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form-fields";
import { QtyStepper } from "@/components/shared/qty-stepper";
import { ProductPicker, type PickedProduct } from "@/features/products/product-picker";
import { useIdempotencyKey } from "@/lib/idempotency";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createEntry } from "./actions";

type EntryType = "RETURN_TO_STOREROOM" | "DAMAGE" | "SUPPLIER_RETURN";

const TYPE_TEXT: Record<EntryType, { label: string; help: string }> = {
  RETURN_TO_STOREROOM: { label: "Return to Store Room", help: "Send good stock back to the Store Room." },
  DAMAGE: { label: "Damaged", help: "Write off pieces that can't be sold." },
  SUPPLIER_RETURN: { label: "Return to supplier", help: "Pieces going back to the supplier." },
};

/**
 * One product per entry. At a store the entry waits for Store Room approval; at the Store Room it applies at once.
 */
export function EntryForm({
  locationId,
  stockLabel,
  types,
  applyImmediately,
}: {
  locationId: string;
  stockLabel: string;
  types: EntryType[];
  applyImmediately: boolean;
}) {
  const router = useRouter();
  const [key, renewKey] = useIdempotencyKey();
  const [type, setType] = useState<EntryType>(types[0]!);
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();

  const ready = product && reason.trim() && quantity >= 1;

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 shadow-card md:p-6">
      <FormError message={error} />
      <FieldSet>
        <FieldLegend>What happened?</FieldLegend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={cn(
                "flex min-h-14 flex-col items-start rounded-lg border border-border px-4 py-2 text-left",
                type === t && "border-primary bg-accent",
              )}
            >
              <span className="font-semibold">{TYPE_TEXT[t].label}</span>
              <span className="text-xs text-muted-foreground">{TYPE_TEXT[t].help}</span>
            </button>
          ))}
        </div>
      </FieldSet>

      <Field>
        <FieldLabel>Product</FieldLabel>
        {product ? (
          <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-2">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{product.name}</span>
              <span className="block text-xs text-muted-foreground">
                {product.sku} · {formatQty(product.quantity)} {stockLabel}
              </span>
            </span>
            <Button type="button" variant="ghost" size="icon" aria-label="Choose a different product" onClick={() => setProduct(null)}>
              <X aria-hidden />
            </Button>
          </div>
        ) : (
          <ProductPicker
            locationId={locationId}
            stockLabel={stockLabel}
            label="Find the product"
            onAdd={(p, qty) => {
              setProduct(p);
              setQuantity(Math.max(1, Math.min(qty, p.quantity || 1)));
            }}
          />
        )}
      </Field>

      <Field>
        <FieldLabel>Quantity</FieldLabel>
        <QtyStepper value={quantity} min={1} max={product?.quantity || undefined} onChange={setQuantity} label="Quantity" />
        {product && product.quantity === 0 && (
          <FieldDescription className="text-danger-foreground">This product has no stock here.</FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="entry-reason">Reason</FieldLabel>
        <Textarea id="entry-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field>

      <ConfirmDialog
        title={`${TYPE_TEXT[type].label}: ${formatQty(quantity)} × ${product?.name ?? ""}?`}
        description={
          applyImmediately
            ? "Stock is reduced now and recorded in the stock history."
            : "The Store Room will approve or reject this. Stock changes only when it's approved."
        }
        confirmLabel={applyImmediately ? "Record" : "Send for approval"}
        onConfirm={async () => {
          setError(undefined);
          const result = await createEntry({ locationId, type, productId: product!.id, quantity, reason, idempotencyKey: key });
          if (!result.ok) {
            setError(result.error);
            return false;
          }
          renewKey();
          toast.success(applyImmediately ? `${result.data.number} recorded` : `${result.data.number} sent for approval`);
          setProduct(null);
          setQuantity(1);
          setReason("");
          router.refresh();
        }}
        trigger={
          <Button type="button" disabled={!ready} className="self-end">
            {applyImmediately ? "Record" : "Send for approval"}
          </Button>
        }
      />
    </div>
  );
}

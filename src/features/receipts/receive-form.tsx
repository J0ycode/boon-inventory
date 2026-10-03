"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form-fields";
import { StickyActionBar } from "@/components/shared/page-header";
import { useTenantHref } from "@/components/shell/tenant-context";
import { addLine, LineEditor, totalPieces, type DocLine } from "@/features/products/line-editor";
import { ProductPicker } from "@/features/products/product-picker";
import { useIdempotencyKey } from "@/lib/idempotency";
import { formatDate, formatQty } from "@/lib/format";
import { receiveStock, setReceiptBill } from "./actions";
import { BillFilePicker, PaymentFields, uploadBill, type PaymentValue } from "./bill-fields";
import { billFileError } from "./schemas";

export function ReceiveForm({
  storeRoomId,
  tenantId,
  suppliers,
}: {
  storeRoomId: string;
  tenantId: string;
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const href = useTenantHref();
  const [key, renewKey] = useIdempotencyKey();
  const [supplierId, setSupplierId] = useState("");
  const [invoice, setInvoice] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DocLine[]>([]);
  const [payment, setPayment] = useState<PaymentValue>({ status: "PAID", dueDate: "", amount: "" });
  const [billFile, setBillFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const [touched, setTouched] = useState(false);
  const [, startTransition] = useTransition();

  const pieces = totalPieces(lines);
  const supplierMissing = touched && !supplierId;
  const invoiceMissing = touched && !invoice.trim();
  const fileError = billFile ? billFileError(billFile) : undefined;
  const amountOk = payment.amount === "" || Number(payment.amount) >= 0;
  const ready = Boolean(
    supplierId &&
      invoice.trim() &&
      lines.length > 0 &&
      (payment.status === "PAID" || payment.dueDate) &&
      amountOk &&
      !fileError,
  );
  const supplierName = suppliers.find((s) => s.id === supplierId)?.name;

  const submit = async () => {
    setError(undefined);
    const result = await receiveStock({
      supplierId,
      invoiceNumber: invoice,
      note,
      idempotencyKey: key,
      paymentStatus: payment.status,
      dueDate: payment.status === "UNPAID" ? payment.dueDate : undefined,
      billAmount: payment.amount === "" ? undefined : Number(payment.amount),
      lines: lines.map((l) => ({
        product_id: l.product_id,
        quantity: l.quantity,
        ...(l.unitCost && Number.isFinite(Number(l.unitCost)) ? { unit_cost: Number(l.unitCost) } : {}),
      })),
    });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    toast.success(`${result.number}: ${formatQty(result.pieces)} pieces received into the Store Room`);
    if (billFile) {
      try {
        const path = await uploadBill(tenantId, result.receiptId, billFile);
        const attached = await setReceiptBill(result.receiptId, path);
        if (!attached.ok) throw new Error(attached.error);
      } catch {
        toast.warning("The stock was received, but the bill file didn't upload. Attach it again from the receipt page.");
      }
    }
    renewKey();
    startTransition(() => router.push(href(`/storeroom/receive/${result.receiptId}`)));
    return true;
  };

  return (
    <div className="flex flex-col gap-5">
      <FormError message={error} />
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <Field data-invalid={supplierMissing || undefined}>
          <FieldLabel htmlFor="receive-supplier">Supplier</FieldLabel>
          <Select value={supplierId || undefined} onValueChange={setSupplierId}>
            <SelectTrigger id="receive-supplier" className="w-full" aria-invalid={supplierMissing || undefined}>
              <SelectValue placeholder="Choose a supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {supplierMissing && <FieldError>Choose the supplier.</FieldError>}
        </Field>
        <Field data-invalid={invoiceMissing || undefined}>
          <FieldLabel htmlFor="receive-invoice">Supplier invoice number</FieldLabel>
          <Input
            id="receive-invoice"
            value={invoice}
            onChange={(e) => setInvoice(e.target.value)}
            autoComplete="off"
            maxLength={60}
            aria-invalid={invoiceMissing || undefined}
          />
          {invoiceMissing && <FieldError>Enter the invoice number.</FieldError>}
        </Field>
      </FieldGroup>

      <div className="flex flex-col gap-3">
        <ProductPicker
          locationId={storeRoomId}
          stockLabel="in Store Room"
          onAdd={(p, qty) =>
            setLines((ls) => addLine(ls, { product_id: p.id, name: p.name, sku: p.sku, quantity: qty }))
          }
        />
        <LineEditor lines={lines} onChange={setLines} showCost />
        {lines.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Unit cost is optional. When entered, it also updates the product&apos;s cost price.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 shadow-card">
        <PaymentFields value={payment} onChange={setPayment} idPrefix="receive-payment" showErrors={touched} />
        <BillFilePicker id="receive-bill" file={billFile} onChange={setBillFile} error={fileError} />
      </div>

      <Field>
        <FieldLabel htmlFor="receive-note">Note (optional)</FieldLabel>
        <Input id="receive-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoComplete="off" />
      </Field>

      <StickyActionBar>
        {ready ? (
          <ConfirmDialog
            title={`Receive ${formatQty(pieces)} pieces?`}
            description={
              <>
                {lines.length} products from {supplierName}, invoice {invoice.trim()}
                {payment.status === "PAID" ? ", marked paid" : `, unpaid (due ${formatDate(payment.dueDate)})`}. This
                adds the stock to the Store Room straight away.
              </>
            }
            confirmLabel="Receive stock"
            onConfirm={submit}
            trigger={<Button type="button">Receive {formatQty(pieces)} pieces</Button>}
          />
        ) : (
          <Button type="button" variant="secondary" onClick={() => setTouched(true)}>
            {lines.length === 0 ? "Add products to receive" : "Receive stock"}
          </Button>
        )}
      </StickyActionBar>
    </div>
  );
}

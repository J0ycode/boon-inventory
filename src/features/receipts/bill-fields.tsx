"use client";

import { useRef } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { BILL_MIME_TYPES, billFileError, todayIso, type PaymentStatus } from "./schemas";

export type PaymentValue = { status: PaymentStatus; dueDate: string; amount: string };

/** Uploads a bill file to {tenant}/{receipt}/… in the private purchase-bills bucket and returns its path. */
export async function uploadBill(tenantId: string, receiptId: string, file: File): Promise<string> {
  const problem = billFileError(file);
  if (problem) throw new Error(problem);
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const path = `${tenantId}/${receiptId}/bill-${Date.now()}.${ext}`;
  const { error } = await createClient()
    .storage.from("purchase-bills")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("The bill file could not be uploaded. Check your connection and try again.");
  return path;
}

/** Paid / Unpaid choice, payment deadline (unpaid only) and optional bill amount. */
export function PaymentFields({
  value,
  onChange,
  idPrefix,
  showErrors,
}: {
  value: PaymentValue;
  onChange: (v: PaymentValue) => void;
  idPrefix: string;
  showErrors?: boolean;
}) {
  const dueMissing = showErrors && value.status === "UNPAID" && !value.dueDate;
  const amountInvalid = value.amount !== "" && !(Number(value.amount) >= 0);

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-2 text-sm font-semibold">Payment</legend>
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          {(["PAID", "UNPAID"] as const).map((s) => (
            <label
              key={s}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-input px-3 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                value.status === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              <input
                type="radio"
                name={`${idPrefix}-status`}
                value={s}
                checked={value.status === s}
                onChange={() => onChange({ ...value, status: s })}
                className="sr-only"
              />
              {s === "PAID" ? "Paid" : "Unpaid"}
            </label>
          ))}
        </div>
      </fieldset>
      {value.status === "UNPAID" && (
        <Field data-invalid={dueMissing || undefined}>
          <FieldLabel htmlFor={`${idPrefix}-due`}>Payment deadline</FieldLabel>
          <Input
            id={`${idPrefix}-due`}
            type="date"
            value={value.dueDate}
            min={todayIso()}
            onChange={(e) => onChange({ ...value, dueDate: e.target.value })}
            aria-invalid={dueMissing || undefined}
          />
          {dueMissing && <FieldError>Enter the payment deadline.</FieldError>}
        </Field>
      )}
      <Field data-invalid={amountInvalid || undefined}>
        <FieldLabel htmlFor={`${idPrefix}-amount`}>Bill amount (₹, optional)</FieldLabel>
        <Input
          id={`${idPrefix}-amount`}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={value.amount}
          onChange={(e) => onChange({ ...value, amount: e.target.value })}
          aria-invalid={amountInvalid || undefined}
        />
        {amountInvalid && <FieldError>Enter a valid amount.</FieldError>}
      </Field>
    </div>
  );
}

/** File chooser for the bill (PDF or photo). Uses the camera on phones when picking an image. */
export function BillFilePicker({
  file,
  onChange,
  id,
  error,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  id: string;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>Bill copy (optional)</FieldLabel>
      <input
        ref={input}
        id={id}
        type="file"
        accept={BILL_MIME_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {file ? (
        <div className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-input px-3">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Remove bill file">
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="justify-start" onClick={() => input.current?.click()}>
          <Paperclip aria-hidden /> Attach bill (PDF or photo, max 10 MB)
        </Button>
      )}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toUserMessage } from "@/lib/errors";
import { orNull } from "@/lib/supabase/rpc";
import { paymentFields, paymentSchema, requireDueDate, type PaymentInput } from "./schemas";

const receiveSchema = z.object({
  supplierId: z.uuid("Choose the supplier this delivery came from."),
  invoiceNumber: z.string().trim().min(1, "Enter the supplier's invoice number.").max(60),
  note: z.string().trim().max(500),
  lines: z
    .array(
      z.object({
        product_id: z.uuid(),
        quantity: z.number().int().min(1).max(100000),
        unit_cost: z.number().min(0).max(10_000_000).optional(),
      }),
    )
    .min(1, "Add at least one product."),
  idempotencyKey: z.uuid(),
  ...paymentFields,
}).superRefine(requireDueDate);

export type ReceiveInput = z.infer<typeof receiveSchema>;

export async function receiveStock(
  input: ReceiveInput,
): Promise<{ ok: true; receiptId: string; number: string; pieces: number } | { ok: false; error: string }> {
  const parsed = receiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the receipt." };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receive_stock", {
    p_supplier_id: v.supplierId,
    p_invoice_number: v.invoiceNumber,
    p_lines: v.lines,
    p_note: v.note,
    p_idempotency_key: v.idempotencyKey,
    p_payment_status: v.paymentStatus,
    p_payment_due_date: orNull(v.paymentStatus === "UNPAID" ? v.dueDate : undefined),
    p_bill_amount: orNull(v.billAmount),
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  const result = data as { receipt_id: string; number: string; pieces: number };
  revalidatePath("/storeroom", "layout");
  return { ok: true, receiptId: result.receipt_id, number: result.number, pieces: result.pieces };
}

export async function setReceiptPayment(input: PaymentInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the payment details." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_receipt_payment", {
    p_receipt_id: v.receiptId,
    p_payment_status: v.paymentStatus,
    p_payment_due_date: orNull(v.paymentStatus === "UNPAID" ? v.dueDate : undefined),
    p_bill_amount: orNull(v.billAmount),
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/storeroom", "layout");
  return { ok: true };
}

/** Links an uploaded bill file (or none, to remove it) and deletes the file it replaces. */
export async function setReceiptBill(
  receiptId: string,
  path: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.uuid().safeParse(receiptId).success) return { ok: false, error: "This bill was not found." };
  const supabase = await createClient();
  const { data: previous, error } = await supabase.rpc("set_receipt_bill", {
    p_receipt_id: receiptId,
    p_bill_path: orNull(path),
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  if (previous && previous !== path) await supabase.storage.from("purchase-bills").remove([previous]);
  revalidatePath("/storeroom", "layout");
  return { ok: true };
}
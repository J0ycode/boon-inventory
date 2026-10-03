import { z } from "zod";

export const PAYMENT_STATUSES = ["PAID", "UNPAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Payment details shared by the receive form and the bill's payment editor. */
export const paymentFields = {
  paymentStatus: z.enum(PAYMENT_STATUSES, "Choose whether the bill is paid or unpaid."),
  dueDate: z.iso.date("Enter a valid payment deadline.").optional(),
  billAmount: z.number("Enter a valid bill amount.").min(0).max(9_999_999_999).optional(),
};

export const requireDueDate = (v: { paymentStatus: PaymentStatus; dueDate?: string }, ctx: z.RefinementCtx) => {
  if (v.paymentStatus === "UNPAID" && !v.dueDate) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Enter the payment deadline for this unpaid bill." });
  }
};

export const paymentSchema = z.object({ receiptId: z.uuid(), ...paymentFields }).superRefine(requireDueDate);
export type PaymentInput = z.infer<typeof paymentSchema>;

/** Accepted bill files: PDF or a photo, up to 10 MB (matches the purchase-bills bucket). */
export const BILL_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const BILL_MAX_BYTES = 10 * 1024 * 1024;

export function billFileError(file: File): string | undefined {
  if (!(BILL_MIME_TYPES as readonly string[]).includes(file.type)) return "Upload a PDF, JPG, PNG or WebP file.";
  if (file.size > BILL_MAX_BYTES) return "The bill file must be 10 MB or smaller.";
  return undefined;
}

export type BillState = "PAID" | "UNPAID" | "DUE_SOON" | "OVERDUE";

/** Today's date (YYYY-MM-DD) in India time, matching how due dates are stored. */
export const todayIso = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Unpaid bills are "due soon" within 3 days of the deadline and "overdue" after it. */
export function billState(status: string, dueDate: string | null, today = todayIso()): BillState {
  if (status === "PAID") return "PAID";
  if (!dueDate) return "UNPAID";
  if (dueDate < today) return "OVERDUE";
  const days = (Date.parse(dueDate) - Date.parse(today)) / 86_400_000;
  return days <= 3 ? "DUE_SOON" : "UNPAID";
}

export const BILL_STATE_LABELS: Record<BillState, string> = {
  PAID: "Paid",
  UNPAID: "Unpaid",
  DUE_SOON: "Due soon",
  OVERDUE: "Overdue",
};

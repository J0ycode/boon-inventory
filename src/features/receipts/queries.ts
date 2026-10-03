import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "./schemas";

export async function listRecentReceipts(limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipts")
    .select(
      "id, number, invoice_number, created_at, payment_status, payment_due_date, supplier:suppliers(name), receipt_lines(quantity)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    pieces: r.receipt_lines.reduce((s, l) => s + l.quantity, 0),
    lineCount: r.receipt_lines.length,
  }));
}

export async function getReceipt(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipts")
    .select(
      "id, number, invoice_number, note, created_at, payment_status, payment_due_date, paid_at, bill_amount, bill_path, supplier:suppliers(name), creator:profiles!receipts_created_by_profile_fkey(full_name), receipt_lines(id, quantity, unit_cost, product:products(id, name, sku, barcode))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Short-lived link to view or download a bill file. */
export async function signBill(path: string | null) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("purchase-bills").createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

export const BILL_FILTERS = ["unpaid", "overdue", "paid", "all"] as const;
export type BillFilter = (typeof BILL_FILTERS)[number];

/** Purchase bills, unpaid ones ordered by deadline (soonest first). */
export async function listBills(filter: BillFilter, limit: number, offset: number) {
  const supabase = await createClient();
  let q = supabase
    .from("receipts")
    .select(
      "id, number, invoice_number, created_at, payment_status, payment_due_date, paid_at, bill_amount, bill_path, supplier:suppliers(name)",
      { count: "exact" },
    );
  if (filter === "unpaid") q = q.eq("payment_status", "UNPAID");
  if (filter === "overdue") q = q.eq("payment_status", "UNPAID").lt("payment_due_date", todayIso());
  if (filter === "paid") q = q.eq("payment_status", "PAID");
  q =
    filter === "unpaid" || filter === "overdue"
      ? q.order("payment_due_date", { ascending: true })
      : q.order("created_at", { ascending: false });
  const { data, count, error } = await q.range(offset, offset + limit - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

/** Totals for the bills page header. */
export async function unpaidTotals() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipts")
    .select("bill_amount, payment_due_date")
    .eq("payment_status", "UNPAID");
  if (error) throw error;
  const today = todayIso();
  const rows = data ?? [];
  const sum = (rs: typeof rows) => rs.reduce((s, r) => s + Number(r.bill_amount ?? 0), 0);
  const overdue = rows.filter((r) => r.payment_due_date && r.payment_due_date < today);
  return { count: rows.length, amount: sum(rows), overdueCount: overdue.length, overdueAmount: sum(overdue) };
}

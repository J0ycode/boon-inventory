import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getLocationSummary() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("location_summary");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    pieces: Number(r.pieces),
    products_in_stock: Number(r.products_in_stock),
    low_stock: Number(r.low_stock),
    out_of_stock: Number(r.out_of_stock),
  }));
}

export type NotificationSummary = Partial<
  Record<"low_stock" | "incoming" | "suggestions" | "requests" | "returns" | "discrepancies" | "bills_overdue" | "bills_due_soon", number>
>;

export async function getNotificationSummary(): Promise<NotificationSummary> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("notification_summary");
  return (data ?? {}) as NotificationSummary;
}

export async function recentMovements({ locationId, limit = 10 }: { locationId?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("stock_movements")
    .select(
      "id, type, quantity_delta, quantity_after, note, created_at, product:products!stock_movements_tenant_id_product_id_fkey(name), location:locations!stock_movements_tenant_id_location_id_fkey(name)",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (locationId) query = query.eq("location_id", locationId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function countActiveProducts() {
  const supabase = await createClient();
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true);
  return count ?? 0;
}

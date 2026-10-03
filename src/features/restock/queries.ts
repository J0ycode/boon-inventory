import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type RestockStatus = Database["public"]["Enums"]["restock_status"];

export async function listRequests({ statuses, locationId, limit = 50 }: { statuses: RestockStatus[]; locationId?: string; limit?: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("restock_requests")
    .select(
      "id, number, status, source, created_at, submitted_at, decided_at, location:locations!restock_requests_tenant_id_location_id_fkey(id, name), restock_request_lines(quantity, line_status)",
    )
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (locationId) query = query.eq("location_id", locationId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => {
    const counted = r.restock_request_lines.filter((l) => l.line_status !== "SKIPPED");
    return { ...r, pieces: counted.reduce((s, l) => s + l.quantity, 0), lineCount: counted.length };
  });
}

export async function countRequests(statuses: RestockStatus[], locationId?: string) {
  const supabase = await createClient();
  let query = supabase.from("restock_requests").select("id", { count: "exact", head: true }).in("status", statuses);
  if (locationId) query = query.eq("location_id", locationId);
  const { count } = await query;
  return count ?? 0;
}

export async function getRequest(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restock_requests")
    .select(
      `id, number, status, source, note, decision_note, created_at, submitted_at, decided_at,
       location:locations!restock_requests_tenant_id_location_id_fkey(id, name),
       creator:profiles!restock_requests_created_by_profile_fkey(full_name),
       dispatches(id, number, status),
       restock_request_lines(id, quantity, suggested_quantity, line_status, product:products(id, name, sku, reorder_level))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  data.restock_request_lines.sort((a, b) => (a.product?.name ?? "").localeCompare(b.product?.name ?? ""));
  return data;
}

export type RequestDetail = NonNullable<Awaited<ReturnType<typeof getRequest>>>;

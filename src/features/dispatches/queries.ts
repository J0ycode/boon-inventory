import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type DispatchStatus = Database["public"]["Enums"]["dispatch_status"];

export const DISPATCH_FILTERS = {
  active: ["DRAFT", "DISPATCHED"],
  issues: ["RECEIVED_WITH_ISSUES"],
  done: ["RECEIVED", "RESOLVED"],
} as const satisfies Record<string, DispatchStatus[]>;

export type DispatchFilter = keyof typeof DISPATCH_FILTERS;

const LIST_SELECT =
  "id, number, status, created_at, dispatched_at, received_at, to:locations!dispatches_tenant_id_to_location_id_fkey(id, name), dispatch_lines(quantity_sent)" as const;

export async function listDispatches({ filter, toLocationId, limit = 50 }: { filter?: DispatchFilter; toLocationId?: string; limit?: number }) {
  const supabase = await createClient();
  let query = supabase.from("dispatches").select(LIST_SELECT).order("created_at", { ascending: false }).limit(limit);
  if (filter) query = query.in("status", [...DISPATCH_FILTERS[filter]]);
  if (toLocationId) query = query.eq("to_location_id", toLocationId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d) => ({ ...d, pieces: d.dispatch_lines.reduce((s, l) => s + l.quantity_sent, 0) }));
}

export async function countDispatches(statuses: DispatchStatus[], toLocationId?: string) {
  const supabase = await createClient();
  let query = supabase.from("dispatches").select("id", { count: "exact", head: true }).in("status", statuses);
  if (toLocationId) query = query.eq("to_location_id", toLocationId);
  const { count } = await query;
  return count ?? 0;
}

export async function getDispatch(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispatches")
    .select(
      `id, number, status, note, created_at, dispatched_at, received_at, restock_request_id,
       from:locations!dispatches_tenant_id_from_location_id_fkey(id, name),
       to:locations!dispatches_tenant_id_to_location_id_fkey(id, name),
       creator:profiles!dispatches_created_by_profile_fkey(full_name),
       receiver:profiles!dispatches_received_by_profile_fkey(full_name),
       dispatch_lines(id, quantity_sent, quantity_received, quantity_missing, quantity_damaged, issue_note, resolution, resolved_at,
                      product:products(id, name, sku, barcode))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  data.dispatch_lines.sort((a, b) => (a.product?.name ?? "").localeCompare(b.product?.name ?? ""));
  return data;
}

export type DispatchDetail = NonNullable<Awaited<ReturnType<typeof getDispatch>>>;

/** Open discrepancy lines (missing/damaged, not yet resolved) for the Store Room. */
export async function listOpenDiscrepancies() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispatch_lines")
    .select(
      "id, quantity_missing, quantity_damaged, issue_note, product:products(name, sku), dispatch:dispatches!inner(id, number, status, received_at, to:locations!dispatches_tenant_id_to_location_id_fkey(name))",
    )
    .eq("dispatch.status", "RECEIVED_WITH_ISSUES")
    .is("resolution", null)
    .or("quantity_missing.gt.0,quantity_damaged.gt.0");
  if (error) throw error;
  return data ?? [];
}

/** Stock available at a location for the given products (for draft editing). */
export async function availableAt(locationId: string, productIds: string[]) {
  if (productIds.length === 0) return new Map<string, number>();
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_levels")
    .select("product_id, quantity")
    .eq("location_id", locationId)
    .in("product_id", productIds);
  return new Map((data ?? []).map((r) => [r.product_id, r.quantity]));
}

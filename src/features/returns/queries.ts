import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listEntries({ status, locationId, limit = 50 }: { status?: "PENDING" | "DONE"; locationId?: string; limit?: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("return_damage_entries")
    .select(
      "id, number, type, quantity, reason, status, created_at, decided_at, decision_note, product:products(name, sku), location:locations!return_damage_entries_tenant_id_location_id_fkey(name, kind), creator:profiles!return_damage_entries_created_by_profile_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status === "PENDING") query = query.eq("status", "PENDING");
  if (status === "DONE") query = query.neq("status", "PENDING");
  if (locationId) query = query.eq("location_id", locationId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export type ReturnEntry = Awaited<ReturnType<typeof listEntries>>[number];

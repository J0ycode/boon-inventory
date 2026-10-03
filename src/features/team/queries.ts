import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, email, role, active, created_at, profile_locations(location_id)")
    .order("role")
    .order("full_name");
  if (error) throw error;
  return (data ?? []).map((m) => ({ ...m, location_ids: m.profile_locations.map((l) => l.location_id) }));
}

export async function listLocations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, kind, address, active")
    .order("kind", { ascending: false })
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export type Member = Awaited<ReturnType<typeof listMembers>>[number];
export type LocationRow = Awaited<ReturnType<typeof listLocations>>[number];

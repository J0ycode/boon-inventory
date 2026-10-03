import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { ReportFilters, ReportKind } from "./definitions";

export type ReportRow = Record<string, string | number | null>;

type MovementType = Database["public"]["Enums"]["movement_type"];

/** Runs one report page (or the export batch). Everything is scoped by RLS in the SQL functions. */
export async function runReport(kind: ReportKind, f: ReportFilters, limit: number, offset: number) {
  const supabase = await createClient();
  const loc = f.locationId || undefined;
  const page = { p_limit: limit, p_offset: offset };
  const { data, error } =
    kind === "stock" || kind === "low"
      ? await supabase.rpc("report_stock", { p_location_id: loc, p_low_only: kind === "low", ...page })
      : kind === "dispatches"
        ? await supabase.rpc("report_dispatches", { p_from: f.from, p_to: f.to, p_location_id: loc, ...page })
        : kind === "returns"
          ? await supabase.rpc("report_returns", { p_from: f.from, p_to: f.to, p_location_id: loc, ...page })
          : await supabase.rpc("report_movements", {
              p_from: f.from,
              p_to: f.to,
              p_location_id: loc,
              p_type: (f.type || undefined) as MovementType | undefined,
              ...page,
            });
  if (error) throw error;
  const rows = (data ?? []) as unknown as (ReportRow & { total_count: number })[];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

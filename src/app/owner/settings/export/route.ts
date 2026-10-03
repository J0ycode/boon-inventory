import { strToU8, zipSync } from "fflate";
import Papa from "papaparse";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Table = keyof Database["public"]["Tables"];

/**
 * Every table that belongs to the shop, and a stable sort column for paging through it.
 * Left out on purpose: api_keys (secret hashes), idempotency_keys and tenant_counters (internal bookkeeping).
 */
const EXPORT_TABLES: { table: Table; order: string }[] = [
  { table: "tenants", order: "id" },
  { table: "locations", order: "id" },
  { table: "profiles", order: "user_id" },
  { table: "profile_locations", order: "user_id" },
  { table: "suppliers", order: "id" },
  { table: "products", order: "id" },
  { table: "product_costs", order: "product_id" },
  { table: "stock_levels", order: "product_id" },
  { table: "stock_movements", order: "id" },
  { table: "receipts", order: "id" },
  { table: "receipt_lines", order: "id" },
  { table: "dispatches", order: "id" },
  { table: "dispatch_lines", order: "id" },
  { table: "restock_requests", order: "id" },
  { table: "restock_request_lines", order: "id" },
  { table: "return_damage_entries", order: "id" },
  { table: "sales", order: "id" },
  { table: "sale_lines", order: "id" },
  { table: "label_print_log", order: "id" },
  { table: "audit_log", order: "id" },
];

const PAGE = 1000;

/** Owner-only: the shop's complete data as a zip of CSV files (one per table). RLS limits every read to this shop. */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return new Response("Only the shop owner can export data.", { status: 403 });
  }

  const supabase = await createClient();
  const files: Record<string, Uint8Array> = {};
  for (const { table, order } of EXPORT_TABLES) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order(order as never, { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) return new Response(`Export failed while reading ${table}. Please try again.`, { status: 500 });
      rows.push(...((data ?? []) as Record<string, unknown>[]));
      if (!data || data.length < PAGE) break;
    }
    const csv = Papa.unparse(
      rows.map((r) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v]),
        ),
      ),
    );
    // BOM so Excel opens UTF-8 (₹, names) correctly.
    files[`${table}.csv`] = strToU8(`﻿${csv}`);
  }
  files["README.txt"] = strToU8(
    `Data export for ${session.tenant.name} (${session.tenant.slug}), created ${new Date().toISOString()}.\n` +
      "One CSV file per table. Ids link the files together (for example receipt_lines.receipt_id -> receipts.id).\n" +
      "Quantities are pieces; money is in INR.\n",
  );

  const zip = zipSync(files, { level: 6 });
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return new Response(zip as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${session.tenant.slug}-export-${date}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}

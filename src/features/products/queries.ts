import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const PAGE_SIZE = 25;

export type Category = Database["public"]["Enums"]["product_category"];
export type StockFilter = "low" | "out";

export type StockListParams = {
  locationId: string;
  q?: string;
  category?: Category;
  supplierId?: string;
  stock?: StockFilter;
  includeInactive?: boolean;
  page: number;
};

/** Parses list filters from the URL. Unknown values are ignored rather than erroring. */
export function parseStockParams(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const category = one("category");
  const stock = one("stock");
  const page = Number.parseInt(one("page") ?? "1", 10);
  return {
    q: one("q")?.slice(0, 100),
    category: category === "CLOTHING" || category === "ACCESSORY" ? (category as Category) : undefined,
    supplierId: one("supplier"),
    stock: stock === "low" || stock === "out" ? (stock as StockFilter) : undefined,
    includeInactive: one("inactive") === "1",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export async function listStock(p: StockListParams) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_stock", {
    p_location_id: p.locationId,
    p_q: p.q ?? undefined,
    p_category: p.category ?? undefined,
    p_supplier_id: p.supplierId ?? undefined,
    p_stock: p.stock ?? undefined,
    p_include_inactive: p.includeInactive ?? false,
    p_limit: PAGE_SIZE,
    p_offset: (p.page - 1) * PAGE_SIZE,
  });
  if (error) throw error;
  const rows = data ?? [];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

export async function listSuppliers({ includeInactive = false } = {}) {
  const supabase = await createClient();
  let query = supabase.from("suppliers").select("id, name, phone, email, address, active").order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getProduct(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, category, sku, barcode, selling_price, supplier_id, reorder_level, image_path, active, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Cost price — returns null for roles that can't see costs (RLS returns no row). */
export async function getCost(productId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("product_costs").select("cost_price").eq("product_id", productId).maybeSingle();
  return data?.cost_price ?? null;
}

export async function getCosts(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, number>();
  const supabase = await createClient();
  const { data } = await supabase.from("product_costs").select("product_id, cost_price").in("product_id", productIds);
  return new Map((data ?? []).map((r) => [r.product_id, Number(r.cost_price)]));
}

/** Stock at every location the caller can see. */
export async function getProductLevels(productId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_levels")
    .select("quantity, location:locations(id, name, kind)")
    .eq("product_id", productId);
  if (error) throw error;
  return (data ?? []).sort((a, b) =>
    a.location?.kind === "STORE_ROOM" ? -1 : b.location?.kind === "STORE_ROOM" ? 1 : 0,
  );
}

export async function getProductMovements(productId: string, locationId?: string, limit = 20) {
  const supabase = await createClient();
  let query = supabase
    .from("stock_movements")
    .select("id, type, quantity_delta, quantity_after, note, created_at, ref_type, location:locations(name)")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (locationId) query = query.eq("location_id", locationId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Short-lived signed URLs for product images (private bucket). */
export async function signImages(paths: (string | null)[]) {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unique.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("product-images").createSignedUrls(unique, 60 * 60);
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]));
}

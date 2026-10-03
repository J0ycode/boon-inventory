"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { toUserMessage } from "@/lib/errors";
import { orNull } from "@/lib/supabase/rpc";
import {
  productSchema,
  supplierSchema,
  type ImportRow,
  type ProductFormValues,
  type SupplierFormValues,
} from "./schemas";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function saveProduct(values: ProductFormValues): Promise<Result<{ id: string }>> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_product", {
    p_id: orNull(v.id),
    p_name: v.name,
    p_category: v.category,
    p_sku: v.sku,
    p_barcode: v.barcode,
    p_selling_price: Number(v.sellingPrice),
    p_supplier_id: orNull(v.supplierId || null),
    p_reorder_level: Number(v.reorderLevel),
    p_active: v.active,
    p_cost_price: orNull(v.costPrice === "" ? null : Number(v.costPrice)),
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/storeroom/products");
  return { ok: true, data: { id: data } };
}

/** Records the uploaded image path (the browser uploads straight to Storage) and removes the old file. */
export async function setProductImage(productId: string, path: string | null): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  if (path && !path.startsWith(`${session.tenant.id}/`)) return { ok: false, error: "Invalid image path." };

  const supabase = await createClient();
  const { data: before } = await supabase.from("products").select("image_path").eq("id", productId).maybeSingle();
  const { error } = await supabase.from("products").update({ image_path: path }).eq("id", productId);
  if (error) return { ok: false, error: toUserMessage(error) };
  if (before?.image_path && before.image_path !== path) {
    await supabase.storage.from("product-images").remove([before.image_path]);
  }
  revalidatePath(`/storeroom/products/${productId}`);
  return { ok: true, data: undefined };
}

export type LookupResult = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  selling_price: number;
  active: boolean;
  quantity: number;
} | null;

/** Scanner lookup by exact barcode or SKU, with stock at one location. */
export async function lookupProduct(code: string, locationId?: string): Promise<LookupResult> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("find_product_by_code", { p_code: code, p_location_id: locationId });
  const row = data?.[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        sku: row.sku,
        barcode: row.barcode,
        selling_price: Number(row.selling_price),
        active: row.active,
        quantity: row.quantity,
      }
    : null;
}

export type PickResult = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  quantity: number;
  selling_price: number;
};

/** Typeahead for product pickers: top matches with stock at one location. */
export async function searchProducts(q: string, locationId: string): Promise<PickResult[]> {
  if (!q.trim()) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_stock", { p_location_id: locationId, p_q: q.trim(), p_limit: 8 });
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    barcode: r.barcode,
    quantity: r.quantity,
    selling_price: Number(r.selling_price),
  }));
}

export type ImportCheck = {
  rows: { row: number; action: "create" | "update"; errors: string[] }[];
  has_errors: boolean;
  created: number;
  updated: number;
};

export async function importProducts(rows: ImportRow[], dryRun: boolean): Promise<Result<ImportCheck>> {
  if (rows.length === 0) return { ok: false, error: "The file has no rows to import." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_products", { p_rows: rows, p_dry_run: dryRun });
  if (error) return { ok: false, error: toUserMessage(error) };
  if (!dryRun) revalidatePath("/storeroom/products");
  return { ok: true, data: data as unknown as ImportCheck };
}

export async function saveSupplier(values: SupplierFormValues): Promise<Result> {
  const parsed = supplierSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  const v = parsed.data;
  const row = {
    name: v.name,
    phone: v.phone || null,
    email: v.email || null,
    address: v.address || null,
    active: v.active,
  };

  const supabase = await createClient();
  const { error } = v.id
    ? await supabase.from("suppliers").update(row).eq("id", v.id)
    : await supabase.from("suppliers").insert({ ...row, tenant_id: session.tenant.id });
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/storeroom/suppliers");
  return { ok: true, data: undefined };
}

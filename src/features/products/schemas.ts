import { z } from "zod";

const money = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Enter an amount like 499 or 499.50");

export const productSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Enter a product name.").max(160, "Keep the name under 160 characters."),
  category: z.enum(["CLOTHING", "ACCESSORY"], { message: "Choose a category." }),
  sku: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === "" || /^[A-Za-z0-9._/-]+$/.test(v), "Use letters, numbers, and . _ / - only."),
  barcode: z
    .string()
    .trim()
    .max(32)
    .refine((v) => v === "" || /^[!-~]+$/.test(v), "Barcodes can't contain spaces or special characters."),
  sellingPrice: money.refine((v) => v !== "", "Enter the selling price."),
  costPrice: money,
  reorderLevel: z
    .string()
    .trim()
    .refine((v) => /^\d{1,6}$/.test(v), "Enter a whole number (0 for no reorder alert)."),
  supplierId: z.string(),
  active: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const supplierSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Enter the supplier's name.").max(120),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("Enter a valid email address.")]),
  address: z.string().trim().max(300),
  active: z.boolean(),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

/** Columns accepted by the CSV/XLSX import (case-insensitive headers; spaces become underscores). */
export const IMPORT_COLUMNS = [
  "name",
  "category",
  "sku",
  "barcode",
  "selling_price",
  "cost_price",
  "reorder_level",
  "supplier",
] as const;

export type ImportRow = Partial<Record<(typeof IMPORT_COLUMNS)[number], string>>;

/** Normalises a parsed sheet row: lower-case headers, trimmed string values, unknown columns dropped. */
export function normaliseImportRow(raw: Record<string, unknown>): ImportRow {
  const row: ImportRow = {};
  for (const [key, value] of Object.entries(raw)) {
    const k = key.trim().toLowerCase().replace(/\s+/g, "_") as (typeof IMPORT_COLUMNS)[number];
    if ((IMPORT_COLUMNS as readonly string[]).includes(k) && value !== null && value !== undefined) {
      row[k] = String(value).trim();
    }
  }
  return row;
}

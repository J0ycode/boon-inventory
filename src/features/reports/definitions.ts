/** Report catalogue shared by the server (queries) and the browser (table + exports). */

export type ReportKind = "stock" | "low" | "dispatches" | "returns" | "movements";
export type ColumnFormat = "text" | "qty" | "delta" | "money" | "datetime";
export type ReportColumn = { key: string; label: string; format?: ColumnFormat; align?: "right" };

export type ReportFilters = { from: string; to: string; locationId?: string; type?: string };

export const REPORTS: Record<ReportKind, { label: string; dated: boolean; columns: ReportColumn[] }> = {
  stock: {
    label: "Stock list",
    dated: false,
    columns: [
      { key: "product", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "barcode", label: "Barcode" },
      { key: "category", label: "Category" },
      { key: "location", label: "Location" },
      { key: "quantity", label: "Qty", format: "qty", align: "right" },
      { key: "reorder_level", label: "Reorder at", format: "qty", align: "right" },
      { key: "selling_price", label: "Price", format: "money", align: "right" },
      { key: "status", label: "Status" },
    ],
  },
  low: {
    label: "Low stock",
    dated: false,
    columns: [
      { key: "product", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "location", label: "Location" },
      { key: "quantity", label: "Qty", format: "qty", align: "right" },
      { key: "reorder_level", label: "Reorder at", format: "qty", align: "right" },
      { key: "status", label: "Status" },
    ],
  },
  dispatches: {
    label: "Dispatch history",
    dated: true,
    columns: [
      { key: "number", label: "Dispatch" },
      { key: "store", label: "Store" },
      { key: "status", label: "Status" },
      { key: "dispatched_at", label: "Sent", format: "datetime" },
      { key: "received_at", label: "Confirmed", format: "datetime" },
      { key: "sent", label: "Sent pcs", format: "qty", align: "right" },
      { key: "received", label: "Received", format: "qty", align: "right" },
      { key: "missing", label: "Missing", format: "qty", align: "right" },
      { key: "damaged", label: "Damaged", format: "qty", align: "right" },
    ],
  },
  returns: {
    label: "Damaged & returns",
    dated: true,
    columns: [
      { key: "happened_at", label: "Date", format: "datetime" },
      { key: "reference", label: "Reference" },
      { key: "location", label: "Location" },
      { key: "kind", label: "Kind" },
      { key: "product", label: "Product" },
      { key: "quantity", label: "Qty", format: "qty", align: "right" },
      { key: "outcome", label: "Outcome" },
      { key: "reason", label: "Reason" },
    ],
  },
  movements: {
    label: "Stock movements",
    dated: true,
    columns: [
      { key: "happened_at", label: "Date", format: "datetime" },
      { key: "location", label: "Location" },
      { key: "product", label: "Product" },
      { key: "type", label: "Type" },
      { key: "quantity_delta", label: "Change", format: "delta", align: "right" },
      { key: "quantity_after", label: "After", format: "qty", align: "right" },
      { key: "by_user", label: "By" },
      { key: "note", label: "Note" },
    ],
  },
};

export const REPORT_PAGE_SIZE = 50;
export const EXPORT_LIMIT = 10000;

export function isReportKind(v: unknown): v is ReportKind {
  return typeof v === "string" && v in REPORTS;
}

const isoDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Default range: the last 30 days (India time). */
export function defaultRange(now = new Date()): { from: string; to: string } {
  const from = new Date(now.getTime() - 29 * 86_400_000);
  return { from: isoDay(from), to: isoDay(now) };
}

export const isIsoDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

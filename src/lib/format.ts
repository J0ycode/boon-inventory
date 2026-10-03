const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});
const date = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export const formatMoney = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? "—" : inr.format(Number(value));

export const formatQty = (value: number | null | undefined) => qty.format(value ?? 0);

export const formatDateTime = (value: string | Date | null | undefined) =>
  value ? dateTime.format(typeof value === "string" ? new Date(value) : value) : "—";

export const formatDate = (value: string | Date | null | undefined) =>
  value ? date.format(typeof value === "string" ? new Date(value) : value) : "—";

/** Signed pieces, e.g. "+12" / "−3" (uses a true minus sign). */
export const formatDelta = (value: number) => (value > 0 ? `+${qty.format(value)}` : `−${qty.format(Math.abs(value))}`);

export const CATEGORY_LABELS = { CLOTHING: "Clothing", ACCESSORY: "Accessory" } as const;

export const MOVEMENT_LABELS: Record<string, string> = {
  RECEIPT: "Received from supplier",
  DISPATCH_OUT: "Dispatched to store",
  DISPATCH_IN: "Received from Store Room",
  SALE: "Sold",
  RETURN_OUT: "Returned to Store Room",
  RETURN_IN: "Returned from store",
  DAMAGE: "Damaged / written off",
  SUPPLIER_RETURN: "Returned to supplier",
  ADJUSTMENT: "Adjustment",
};

/** Stock status for chips: OUT (0), LOW (≤ reorder level, when one is set), else IN_STOCK. */
export function stockStatus(quantity: number, reorderLevel: number): "OUT" | "LOW" | "IN_STOCK" {
  if (quantity <= 0) return "OUT";
  if (reorderLevel > 0 && quantity <= reorderLevel) return "LOW";
  return "IN_STOCK";
}

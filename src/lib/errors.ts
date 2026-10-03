/**
 * Turns database / Supabase errors into plain-language messages for the UI.
 *
 * Business errors raised by Postgres functions (app.raise) carry a stable code in `hint` (e.g. BB_INSUFFICIENT_STOCK)
 * and a human-written `message`. The message is usually specific enough to show as-is; the map below only
 * overrides codes where the UI wants different wording or where Postgres gives a raw constraint error.
 */

export type AppErrorCode =
  | "BB_NOT_SIGNED_IN"
  | "BB_NO_PROFILE"
  | "BB_FORBIDDEN"
  | "BB_TENANT_CANCELED"
  | "BB_TENANT_PAST_DUE"
  | "BB_TRIAL_ENDED"
  | "BB_LOCATION_NOT_FOUND"
  | "BB_NOT_FOUND"
  | "BB_INSUFFICIENT_STOCK"
  | "BB_INVALID_QUANTITY"
  | "BB_IDEMPOTENCY_MISMATCH"
  | "BB_ALREADY_HAS_SHOP"
  | "BB_INVALID_SLUG"
  | "BB_SLUG_TAKEN";

type DbError = { message?: string; code?: string; hint?: string | null; details?: string | null };

const FALLBACK = "Something went wrong. Please try again.";

const CONSTRAINT_MESSAGES: Record<string, string> = {
  products_tenant_id_sku_key: "Another product already uses this SKU.",
  products_tenant_id_barcode_key: "Another product already uses this barcode.",
  suppliers_tenant_id_name_key: "A supplier with this name already exists.",
  locations_tenant_id_name_key: "A location with this name already exists.",
};

export function errorCode(error: unknown): AppErrorCode | null {
  const hint = (error as DbError | null)?.hint;
  return typeof hint === "string" && hint.startsWith("BB_") ? (hint as AppErrorCode) : null;
}

export function toUserMessage(error: unknown): string {
  if (!error) return FALLBACK;
  const e = error as DbError;

  // Raised by our own functions: the message is already written for people.
  if (errorCode(e) && e.message) return e.message;

  // Postgres error classes we can explain.
  switch (e.code) {
    case "23505": {
      const constraint = Object.keys(CONSTRAINT_MESSAGES).find((c) => e.message?.includes(c));
      return constraint ? CONSTRAINT_MESSAGES[constraint] : "This record already exists.";
    }
    case "23514":
      return e.message?.includes("quantity")
        ? "Stock can't go below zero."
        : "Some values are not allowed. Please check the form.";
    case "42501":
      return "You do not have permission to do this.";
    case "PGRST301":
    case "PGRST303":
      return "Your session has expired. Please sign in again.";
  }

  if (e.message?.toLowerCase().includes("failed to fetch") || e.message?.toLowerCase().includes("network")) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return FALLBACK;
}

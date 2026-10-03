// Pure request/response logic for the sales API, shared by the Edge Function and unit tests (no Deno APIs here).

export type SaleItem = { barcode: string; quantity: number };
export type SaleRequest = { location_id: string; external_ref: string; items: SaleItem[] };

export type ApiError = { status: number; code: string; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** API key from `Authorization: Bearer <key>` or `X-API-Key: <key>`. */
export function extractApiKey(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  return headers.get("x-api-key")?.trim() || null;
}

export function parseSaleRequest(body: unknown): { ok: true; value: SaleRequest } | { ok: false; error: ApiError } {
  const fail = (message: string) => ({ ok: false as const, error: { status: 400, code: "INVALID_REQUEST", message } });
  if (!body || typeof body !== "object") return fail("Body must be a JSON object.");
  const b = body as Record<string, unknown>;
  if (typeof b.location_id !== "string" || !UUID.test(b.location_id)) return fail("location_id must be a store UUID.");
  if (typeof b.external_ref !== "string" || !b.external_ref.trim() || b.external_ref.length > 120) {
    return fail("external_ref is required (1–120 characters).");
  }
  if (!Array.isArray(b.items) || b.items.length === 0) return fail("items must be a non-empty array.");
  if (b.items.length > 500) return fail("A sale can have up to 500 items.");
  const items: SaleItem[] = [];
  for (const [i, raw] of b.items.entries()) {
    const it = raw as Record<string, unknown>;
    if (!it || typeof it.barcode !== "string" || !it.barcode.trim()) return fail(`items[${i}].barcode is required.`);
    if (typeof it.quantity !== "number" || !Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 100000) {
      return fail(`items[${i}].quantity must be a whole number from 1 to 100000.`);
    }
    items.push({ barcode: it.barcode.trim(), quantity: it.quantity });
  }
  return { ok: true, value: { location_id: b.location_id, external_ref: b.external_ref.trim(), items } };
}

/** Maps database error codes (raised by app.raise, carried in `hint`) to HTTP errors with stable API codes. */
export function mapDbError(hint: string | null | undefined, message: string): ApiError {
  switch (hint) {
    case "BB_INVALID_API_KEY":
      return { status: 401, code: "INVALID_API_KEY", message };
    case "BB_TENANT_PAST_DUE":
    case "BB_TENANT_CANCELED":
    case "BB_TRIAL_ENDED":
      return { status: 403, code: "ACCOUNT_READ_ONLY", message };
    case "BB_LOCATION_NOT_FOUND":
      return { status: 404, code: "LOCATION_NOT_FOUND", message };
    case "BB_UNKNOWN_BARCODE":
      return { status: 422, code: "UNKNOWN_BARCODE", message };
    case "BB_INSUFFICIENT_STOCK":
      return { status: 409, code: "INSUFFICIENT_STOCK", message };
    case "BB_INVALID_REQUEST":
      return { status: 400, code: "INVALID_REQUEST", message };
    default:
      return { status: 500, code: "INTERNAL_ERROR", message: "Something went wrong. Retry with the same external_ref." };
  }
}

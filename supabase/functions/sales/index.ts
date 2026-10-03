// POST /functions/v1/sales — records a sale from the billing module and reduces that store's stock.
// Auth: per-tenant API key (Authorization: Bearer bb_live_…). Idempotent on external_ref. See README "Sales API".
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractApiKey, mapDbError, parseSaleRequest, type ApiError } from "./logic.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const error = (e: ApiError) => json(e.status, { error: { code: e.code, message: e.message } });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // server-side only; the DB function verifies the tenant API key
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return error({ status: 405, code: "METHOD_NOT_ALLOWED", message: "Use POST." });
  }
  const apiKey = extractApiKey(req.headers);
  if (!apiKey) {
    return error({ status: 401, code: "INVALID_API_KEY", message: "Send the API key as: Authorization: Bearer <key>." });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error({ status: 400, code: "INVALID_REQUEST", message: "Body must be valid JSON." });
  }
  const parsed = parseSaleRequest(body);
  if (!parsed.ok) return error(parsed.error);

  const { data, error: dbError } = await supabase.rpc("api_record_sale", {
    p_api_key: apiKey,
    p_location_id: parsed.value.location_id,
    p_external_ref: parsed.value.external_ref,
    p_items: parsed.value.items,
  });
  if (dbError) {
    const mapped = mapDbError(dbError.hint, dbError.message);
    if (mapped.status === 500) console.error("sales: unexpected database error", dbError);
    return error(mapped);
  }
  return json(data.duplicate ? 200 : 201, data);
});

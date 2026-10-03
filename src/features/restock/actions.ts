"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { orNull } from "@/lib/supabase/rpc";
import { toUserMessage } from "@/lib/errors";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function refresh() {
  revalidatePath("/store", "layout");
  revalidatePath("/storeroom", "layout");
}

const requestSchema = z.object({
  id: z.uuid().nullable(),
  locationId: z.uuid(),
  note: z.string().trim().max(500),
  send: z.boolean(),
  lines: z.array(z.object({ product_id: z.uuid(), quantity: z.number().int().min(1).max(100000) })).min(1, "Add at least one product."),
  idempotencyKey: z.uuid(),
});

export async function saveRequest(input: z.infer<typeof requestSchema>): Promise<Result<{ id: string; number: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the request." };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_restock_request", {
    p_id: orNull(v.id),
    p_location_id: v.locationId,
    p_lines: v.lines,
    p_note: v.note,
    p_send: v.send,
    p_idempotency_key: v.idempotencyKey,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  refresh();
  const r = data as { request_id: string; number: string };
  return { ok: true, data: { id: r.request_id, number: r.number } };
}

export async function deleteRequest(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_restock_draft", { p_id: id });
  if (error) return { ok: false, error: toUserMessage(error) };
  refresh();
  return { ok: true, data: undefined };
}

export async function generateSuggestions(locationId: string): Promise<Result<{ lines: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_restock_suggestions", { p_location_id: locationId });
  if (error) return { ok: false, error: toUserMessage(error) };
  refresh();
  return { ok: true, data: data as { lines: number } };
}

export async function reviewLine(lineId: string, action: "APPROVE" | "SKIP", quantity?: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_suggestion_line", {
    p_line_id: lineId,
    p_action: action,
    p_quantity: quantity,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  refresh();
  return { ok: true, data: undefined };
}

export async function forwardSuggestions(requestId: string, idempotencyKey: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("forward_suggestions", { p_request_id: requestId, p_idempotency_key: idempotencyKey });
  if (error) return { ok: false, error: toUserMessage(error) };
  refresh();
  return { ok: true, data: undefined };
}

export async function decideRequest(
  id: string,
  approve: boolean,
  note: string,
  idempotencyKey: string,
): Promise<Result<{ dispatchId?: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_restock_request", {
    p_id: id,
    p_approve: approve,
    p_note: note,
    p_idempotency_key: idempotencyKey,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  refresh();
  return { ok: true, data: { dispatchId: (data as { dispatch_id?: string }).dispatch_id } };
}

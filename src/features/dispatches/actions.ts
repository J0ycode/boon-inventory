"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { orNull } from "@/lib/supabase/rpc";
import { toUserMessage } from "@/lib/errors";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const lineSchema = z.object({ product_id: z.uuid(), quantity: z.number().int().min(1).max(100000) });

const draftSchema = z.object({
  id: z.uuid().nullable(),
  toLocationId: z.uuid("Choose the store to send to."),
  note: z.string().trim().max(500),
  lines: z.array(lineSchema).min(1, "Add at least one product."),
});

function refresh() {
  revalidatePath("/storeroom", "layout");
  revalidatePath("/store", "layout");
}

export async function saveDispatchDraft(input: z.infer<typeof draftSchema>): Promise<Result<{ id: string }>> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the dispatch." };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_dispatch_draft", {
    p_id: orNull(v.id),
    p_to_location_id: v.toLocationId,
    p_lines: v.lines,
    p_note: v.note,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  refresh();
  return { ok: true, data: { id: data } };
}

export async function deleteDispatchDraft(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_dispatch_draft", { p_id: id });
  if (error) return { ok: false, error: toUserMessage(error) };
  refresh();
  return { ok: true, data: undefined };
}

export async function sendDispatch(id: string, idempotencyKey: string): Promise<Result<{ number: string; pieces: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_dispatch", { p_id: id, p_idempotency_key: idempotencyKey });
  if (error) return { ok: false, error: toUserMessage(error) };
  refresh();
  const r = data as { number: string; pieces: number };
  return { ok: true, data: r };
}

const receiveSchema = z.array(
  z.object({
    line_id: z.uuid(),
    received: z.number().int().min(0),
    missing: z.number().int().min(0),
    damaged: z.number().int().min(0),
    note: z.string().trim().max(500),
  }),
);

export async function receiveDispatch(
  id: string,
  lines: z.infer<typeof receiveSchema>,
  idempotencyKey: string,
): Promise<Result<{ status: string }>> {
  const parsed = receiveSchema.safeParse(lines);
  if (!parsed.success) return { ok: false, error: "Check the quantities." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receive_dispatch", {
    p_id: id,
    p_lines: parsed.data,
    p_idempotency_key: idempotencyKey,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  refresh();
  return { ok: true, data: data as { status: string } };
}

export async function resolveDiscrepancy(
  lineId: string,
  resolution: "RETURN_TO_STOCK" | "WRITE_OFF",
  note: string,
  idempotencyKey: string,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_discrepancy", {
    p_line_id: lineId,
    p_resolution: resolution,
    p_note: note,
    p_idempotency_key: idempotencyKey,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  refresh();
  return { ok: true, data: undefined };
}

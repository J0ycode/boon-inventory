"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toUserMessage } from "@/lib/errors";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const entrySchema = z.object({
  locationId: z.uuid(),
  type: z.enum(["RETURN_TO_STOREROOM", "DAMAGE", "SUPPLIER_RETURN"]),
  productId: z.uuid("Choose a product."),
  quantity: z.number().int().min(1).max(100000),
  reason: z.string().trim().min(1, "Give a reason.").max(500),
  idempotencyKey: z.uuid(),
});

export async function createEntry(input: z.infer<typeof entrySchema>): Promise<Result<{ number: string; status: string }>> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_return_damage_entry", {
    p_location_id: v.locationId,
    p_type: v.type,
    p_product_id: v.productId,
    p_quantity: v.quantity,
    p_reason: v.reason,
    p_idempotency_key: v.idempotencyKey,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/store", "layout");
  revalidatePath("/storeroom", "layout");
  return { ok: true, data: data as { number: string; status: string } };
}

export async function decideEntry(id: string, approve: boolean, note: string, idempotencyKey: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_return_damage", {
    p_id: id,
    p_approve: approve,
    p_note: note,
    p_idempotency_key: idempotencyKey,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/store", "layout");
  revalidatePath("/storeroom", "layout");
  return { ok: true, data: undefined };
}

"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";

const logSchema = z.object({
  preset: z.union([z.literal(24), z.literal(40), z.literal(65)]),
  labelCount: z.number().int().min(1),
  productCount: z.number().int().min(1),
  source: z.enum(["PRODUCTS", "RECEIPT"]),
  receiptId: z.uuid().nullable(),
});

/** Every print / PDF download is logged (who, when, how many, from which receipt). */
export async function logLabelPrint(input: z.infer<typeof logSchema>): Promise<void> {
  const parsed = logSchema.safeParse(input);
  const session = await getSession();
  if (!parsed.success || !session) return;
  const v = parsed.data;
  const supabase = await createClient();
  await supabase.from("label_print_log").insert({
    tenant_id: session.tenant.id,
    user_id: session.user_id,
    preset: v.preset,
    label_count: v.labelCount,
    product_count: v.productCount,
    source: v.source,
    receipt_id: v.receiptId,
  });
}

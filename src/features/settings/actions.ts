"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { toUserMessage } from "@/lib/errors";
import { companySchema } from "./schemas";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };



export async function saveCompany(input: z.infer<typeof companySchema>): Promise<Result> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const session = await getSession();
  if (!session || session.role !== "OWNER") return { ok: false, error: "Only the owner can change company details." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      name: v.name,
      legal_name: v.legalName || null,
      address: v.address || null,
      phone: v.phone || null,
      email: v.email || null,
      tax_id: v.taxId || null,
    })
    .eq("id", session.tenant.id);
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function createApiKey(name: string): Promise<Result<{ key: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_api_key", { p_name: name });
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/owner/settings");
  return { ok: true, data: { key: (data as { key: string }).key } };
}

export async function rotateApiKey(id: string): Promise<Result<{ key: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rotate_api_key", { p_id: id });
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/owner/settings");
  return { ok: true, data: { key: (data as { key: string }).key } };
}

export async function revokeApiKey(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_api_key", { p_id: id });
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/owner/settings");
  return { ok: true, data: undefined };
}

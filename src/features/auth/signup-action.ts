"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { toUserMessage } from "@/lib/errors";
import { isValidSlug, tenantUrl } from "@/lib/tenant/resolve";

const signupSchema = z.object({
  ownerName: z.string().trim().min(1, "Enter your name.").max(80),
  shopName: z.string().trim().min(1, "Enter your shop name.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidSlug, "Shop address must be 3–32 characters: lowercase letters, numbers and hyphens."),
  storeName: z.string().trim().max(60),
  email: z.email("Enter a valid email address.").max(254),
  password: z.string().min(8, "Use at least 8 characters for the password.").max(72),
  /** Honeypot: real people never fill this hidden field. */
  website: z.string().max(0).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

export async function checkSlug(slug: string): Promise<boolean> {
  if (!isValidSlug(slug.toLowerCase())) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("slug_available", { p_slug: slug });
  return data === true;
}

/**
 * Creates the owner's login and the shop (Store Room + first Store) in one go, then sends them to the new shop's
 * login page. If the shop can't be created, the just-created login is removed so they can try again.
 */
export async function signUp(input: SignupInput): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  if (v.website) return { ok: false, error: "Something went wrong. Please try again." };

  if (!(await checkSlug(v.slug))) return { ok: false, error: "That shop address is already taken. Try another." };

  const admin = createAdminClient();
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { full_name: v.ownerName },
  });
  if (userError || !created.user) {
    const taken = userError?.code === "email_exists" || /already/i.test(userError?.message ?? "");
    return {
      ok: false,
      error: taken
        ? "An account with this email already exists. Sign in to your shop, or use a different email."
        : "We couldn't create your account. Please try again.",
    };
  }

  const { error } = await admin.rpc("signup_create_tenant", {
    p_user_id: created.user.id,
    p_email: v.email,
    p_owner_name: v.ownerName,
    p_shop_name: v.shopName,
    p_slug: v.slug,
    p_store_name: v.storeName || "Store A",
  });
  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: toUserMessage(error) };
  }

  return { ok: true, url: tenantUrl(v.slug, `/login?welcome=1&email=${encodeURIComponent(v.email)}`) };
}

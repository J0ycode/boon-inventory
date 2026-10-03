"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTenantSlug, getSession } from "@/lib/session";
import { portalHome } from "@/lib/roles";
import { tenantPath, tenantUrl } from "@/lib/tenant/resolve";
import { loginSchema, resetRequestSchema, updatePasswordSchema } from "./schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

const GENERIC_LOGIN_ERROR = "Email or password is incorrect.";

/** Only allow same-tenant, in-app paths as post-login destinations. */
function safeNext(next: unknown): string | null {
  return typeof next === "string" && /^\/(owner|storeroom|store)(\/[\w\-/]*)?$/.test(next) ? next : null;
}

/**
 * Returns the destination instead of redirecting: the client does a full navigation so the portal renders
 * with fresh auth state.
 */
export async function signIn(
  input: z.infer<typeof loginSchema> & { next?: string },
): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter your email and password." };

  // On a shop's address the account must belong to that shop. On the main site any account may sign in and is
  // sent to its own shop.
  const slug = await getTenantSlug();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      error: error.message.toLowerCase().includes("fetch")
        ? "Can't reach the server. Check your connection and try again."
        : GENERIC_LOGIN_ERROR,
    };
  }

  const { data: session } = await supabase.rpc("my_context");
  const ctx = session as { role: Parameters<typeof portalHome>[0]; tenant: { slug: string } } | null;
  if (!ctx) {
    await supabase.auth.signOut();
    return { ok: false, error: "This account is not linked to a shop, or it has been deactivated." };
  }
  if (!slug) return { ok: true, redirectTo: tenantUrl(ctx.tenant.slug, portalHome(ctx.role)) };
  if (ctx.tenant.slug !== slug) {
    // Valid user, wrong shop address. Don't leak which shop they belong to.
    await supabase.auth.signOut();
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  const next = safeNext(input.next);
  const home = portalHome(ctx.role);
  return { ok: true, redirectTo: tenantPath(slug, next && next.startsWith(home) ? next : home) };
}

export async function signOut(): Promise<void> {
  const slug = await getTenantSlug();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(slug ? tenantPath(slug, "/login") : "/");
}

export async function requestPasswordReset(input: z.infer<typeof resetRequestSchema>): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const slug = await getTenantSlug();
  if (!slug) return { ok: false, error: "Open your shop's address to reset your password." };

  const supabase = await createClient();
  // The email link comes back to this shop's /auth/confirm, which verifies the token and opens /update-password.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: tenantUrl(slug, "/auth/confirm") });
  // Always report success so the form can't be used to discover which emails have accounts.
  return { ok: true };
}

export async function updatePassword(input: z.infer<typeof updatePasswordSchema>): Promise<ActionResult> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("different")
        ? "Choose a password you haven't used before."
        : "Couldn't update your password. The link may have expired — request a new one.",
    };
  }
  const session = await getSession();
  const slug = await getTenantSlug();
  redirect(session && slug ? tenantPath(slug, portalHome(session.role)) : "/");
}

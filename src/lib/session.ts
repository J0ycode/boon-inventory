import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveTenant, TENANT_HEADER, TENANT_MODE, tenantPath, tenantUrl } from "@/lib/tenant/resolve";
import type { AppRole, SessionContext } from "@/lib/roles";
import { portalHome } from "@/lib/roles";

/**
 * Tenant slug for this request. Prefers the header set by the proxy; falls back to resolving the Host header,
 * because renders that follow a Server Action redirect don't always carry proxy-added request headers.
 */
export const getTenantSlug = cache(async (): Promise<string | null> => {
  const h = await headers();
  return h.get(TENANT_HEADER) ?? (TENANT_MODE === "subdomain" ? resolveTenant(h.get("host"), "/").slug : null);
});

/** The signed-in user's profile, tenant, and locations — or null when signed out / not linked to a shop. */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_context");
  if (error || !data) return null;
  return data as unknown as SessionContext;
});

/**
 * Guard for portal layouts and pages. Redirects instead of rendering when the visitor is signed out,
 * belongs to another shop, or has a role that doesn't match the portal. Data access is still enforced by RLS.
 */
export async function requireRole(roles: AppRole[]): Promise<SessionContext> {
  const slug = await getTenantSlug();
  if (!slug) redirect("/");

  const session = await getSession();
  if (!session) redirect(tenantPath(slug, "/login"));

  if (session.tenant.slug !== slug) {
    // Signed in, but to a different shop (only possible when the auth cookie spans subdomains).
    redirect(tenantUrl(session.tenant.slug, portalHome(session.role)));
  }
  if (!roles.includes(session.role)) {
    redirect(tenantPath(slug, portalHome(session.role)));
  }
  return session;
}

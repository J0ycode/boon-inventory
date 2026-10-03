"use client";

import { createContext, useCallback, useContext } from "react";
import { usePathname } from "next/navigation";
import { TENANT_MODE, tenantPath } from "@/lib/tenant/resolve";
import type { SessionContext } from "@/lib/roles";

const TenantContext = createContext<SessionContext | null>(null);

export function TenantProvider({ session, children }: { session: SessionContext; children: React.ReactNode }) {
  return <TenantContext.Provider value={session}>{children}</TenantContext.Provider>;
}

export function useSession(): SessionContext {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useSession must be used inside <TenantProvider>");
  return ctx;
}

/** Builds in-app hrefs that work in both subdomain and path tenant modes. */
export function useTenantHref() {
  const { tenant } = useSession();
  return useCallback((path: string) => tenantPath(tenant.slug, path), [tenant.slug]);
}

/** Current pathname without the /t/{slug} prefix used in path mode. */
export function useAppPathname(): string {
  const pathname = usePathname();
  const { tenant } = useSession();
  if (TENANT_MODE === "path") {
    const prefix = `/t/${tenant.slug}`;
    if (pathname.startsWith(prefix)) return pathname.slice(prefix.length) || "/";
  }
  return pathname;
}

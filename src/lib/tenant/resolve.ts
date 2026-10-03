/**
 * The ONLY place that knows how a request maps to a tenant.
 *
 * - "subdomain" mode (default): {slug}.{ROOT_DOMAIN}, e.g. boonbaby.localhost:3000 or boonbaby.example.com
 * - "path" mode (fallback):     {ROOT_DOMAIN}/t/{slug}/...
 *
 * Switch with NEXT_PUBLIC_TENANT_MODE. Everything else (links, redirects, email links) goes through
 * the helpers below, so changing mode never touches feature code.
 */

export type TenantMode = "subdomain" | "path";

export const TENANT_MODE: TenantMode = process.env.NEXT_PUBLIC_TENANT_MODE === "path" ? "path" : "subdomain";

/** Host (with port in dev) that serves the marketing/signup pages, e.g. "localhost:3000" or "example.com". */
export const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").toLowerCase();

const PROTOCOL = process.env.NEXT_PUBLIC_SITE_PROTOCOL ?? (ROOT_DOMAIN.startsWith("localhost") ? "http" : "https");

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const RESERVED = new Set(["www", "app", "api", "admin", "auth", "mail", "static"]);

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED.has(slug);
}

export type ResolvedTenant = {
  /** Tenant slug, or null for the root domain. */
  slug: string | null;
  /** Path inside the app with any tenant prefix removed (what the App Router should render). */
  pathname: string;
};

export function resolveTenant(host: string | null, pathname: string, mode: TenantMode = TENANT_MODE): ResolvedTenant {
  if (mode === "path") {
    const match = /^\/t\/([^/]+)(\/.*)?$/.exec(pathname);
    if (match && isValidSlug(match[1])) {
      return { slug: match[1], pathname: match[2] ?? "/" };
    }
    return { slug: null, pathname };
  }

  const hostname = (host ?? "").toLowerCase();
  if (hostname === ROOT_DOMAIN || !hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    return { slug: null, pathname };
  }
  const sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
  if (sub.includes(".") || !isValidSlug(sub)) {
    return { slug: null, pathname };
  }
  return { slug: sub, pathname };
}

/** Path to use in links and redirects within a tenant (adds the /t/{slug} prefix in path mode). */
export function tenantPath(slug: string, path: string, mode: TenantMode = TENANT_MODE): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return mode === "path" ? `/t/${slug}${clean === "/" ? "" : clean}` : clean;
}

/** Absolute URL for a tenant page — used for email links and cross-host redirects (e.g. after signup). */
export function tenantUrl(slug: string, path: string, mode: TenantMode = TENANT_MODE): string {
  return mode === "path"
    ? `${PROTOCOL}://${ROOT_DOMAIN}${tenantPath(slug, path, mode)}`
    : `${PROTOCOL}://${slug}.${ROOT_DOMAIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Absolute URL on the root domain (signup, find-your-shop). */
export function rootUrl(path = "/"): string {
  return `${PROTOCOL}://${ROOT_DOMAIN}${path}`;
}

/** Request header the proxy sets so server components know the tenant. Always overwritten by the proxy. */
export const TENANT_HEADER = "x-boonbaby-tenant";

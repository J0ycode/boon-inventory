import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveTenant, tenantPath, TENANT_HEADER, TENANT_MODE } from "@/lib/tenant/resolve";
import { authCookieOptions, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/** Pages on the root domain (no tenant). Everything else on the root domain goes to "/". */
const ROOT_PATHS = ["/", "/signup"];

/** Tenant pages that work without a session. */
const PUBLIC_TENANT_PATHS = ["/login", "/reset-password", "/auth/confirm"];

const matches = (pathname: string, list: string[]) =>
  list.some((p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)));

/**
 * Runs before every page request:
 * 1. Resolves the tenant from the host (or /t/{slug} in path mode) and passes it on in a request header.
 * 2. Refreshes the Supabase session cookie.
 * 3. Sends signed-out visitors to the tenant's login page.
 *
 * Role checks happen in the portal layouts and, for data, in Postgres RLS — never only here.
 */
export async function proxy(request: NextRequest) {
  const { slug, pathname } = resolveTenant(request.headers.get("host"), request.nextUrl.pathname);

  const forward = () => {
    const headers = new Headers(request.headers);
    headers.delete(TENANT_HEADER); // never trust a client-supplied value
    if (slug) headers.set(TENANT_HEADER, slug);
    if (TENANT_MODE === "path" && slug) {
      const url = request.nextUrl.clone();
      url.pathname = pathname;
      return NextResponse.rewrite(url, { request: { headers } });
    }
    return NextResponse.next({ request: { headers } });
  };

  if (!slug) {
    if (matches(pathname, ROOT_PATHS)) return forward();
    return NextResponse.redirect(new URL("/", request.url));
  }

  let response = forward();
  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = forward();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Validates the JWT (and refreshes it when needed). Do not put code between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !matches(pathname, PUBLIC_TENANT_PATHS)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = tenantPath(slug, "/login");
    loginUrl.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

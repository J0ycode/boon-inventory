import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADER, tenantPath } from "@/lib/tenant/resolve";

const ALLOWED: EmailOtpType[] = ["invite", "recovery"];

/**
 * Landing point for invite and password-reset email links. Verifies the one-time token (which signs the user in
 * on this tenant's host) and sends them to choose a password.
 */
export async function GET(request: NextRequest) {
  const slug = request.headers.get(TENANT_HEADER);
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (!slug) return NextResponse.redirect(new URL("/", request.url));

  const to = (path: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = tenantPath(slug, path);
    url.search = search;
    return NextResponse.redirect(url);
  };

  if (!tokenHash || !type || !ALLOWED.includes(type)) return to("/login", "?error=link");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return to("/login", "?error=link");

  return to("/update-password");
}

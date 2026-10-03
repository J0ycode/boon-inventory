import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { authCookieOptions, supabasePublishableKey, supabaseUrl } from "./env";

/** Supabase client for Client Components. Acts as the signed-in user (RLS applies). */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookieOptions: authCookieOptions(),
  });
}

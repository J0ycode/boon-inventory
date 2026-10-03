import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Public shop info for the login page. Returns null when the subdomain isn't a real shop. */
export const getTenantPublicInfo = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("tenant_public_info", { p_slug: slug });
  return data?.[0] ?? null;
});

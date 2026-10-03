"use server";

import { isValidSlug, tenantUrl } from "@/lib/tenant/resolve";
import { getTenantPublicInfo } from "./queries";

export async function findShop(slug: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const clean = slug.trim().toLowerCase();
  if (!isValidSlug(clean) || !(await getTenantPublicInfo(clean))) {
    return { ok: false, error: "We couldn't find a shop with that address." };
  }
  return { ok: true, url: tenantUrl(clean, "/login") };
}

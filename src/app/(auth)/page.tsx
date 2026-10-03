import Link from "next/link";
import { redirect } from "next/navigation";
import { FindShopForm } from "@/features/auth/find-shop-form";
import { getSession, getTenantSlug } from "@/lib/session";
import { portalHome } from "@/lib/roles";
import { tenantPath } from "@/lib/tenant/resolve";

/**
 * On a tenant host: send the visitor to their portal (or the login page).
 * On the root domain: "find your shop" (signup arrives in Phase 10).
 */
export default async function RootPage() {
  const slug = await getTenantSlug();
  if (slug) {
    const session = await getSession();
    redirect(tenantPath(slug, session ? portalHome(session.role) : "/login"));
  }

  return (
    <>
      <h1 className="text-xl font-extrabold tracking-tight">Find your shop</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Enter your shop&apos;s address to sign in.</p>
      <FindShopForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
          Create your shop
        </Link>
      </p>
    </>
  );
}

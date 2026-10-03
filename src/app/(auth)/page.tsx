import Link from "next/link";
import { redirect } from "next/navigation";
import { FindShopForm } from "@/features/auth/find-shop-form";
import { LoginForm } from "@/features/auth/login-form";
import { getSession, getTenantSlug } from "@/lib/session";
import { portalHome } from "@/lib/roles";
import { tenantPath } from "@/lib/tenant/resolve";

/**
 * On a shop's address: send the visitor to their portal (or that shop's login page).
 * On the main site: sign in with email and password (we find the shop from the account), or, for a password
 * reset, find the shop first.
 */
export default async function RootPage({ searchParams }: PageProps<"/">) {
  const slug = await getTenantSlug();
  if (slug) {
    const session = await getSession();
    redirect(tenantPath(slug, session ? portalHome(session.role) : "/login"));
  }

  const findShop = (await searchParams).find === "1";
  if (findShop) {
    return (
      <>
        <h1 className="text-xl font-extrabold tracking-tight">Find your shop</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Enter your shop&apos;s address to reset your password there.
        </p>
        <FindShopForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/" className="font-semibold text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-extrabold tracking-tight">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Use the email and password for your shop account.</p>
      <LoginForm resetHref="/?find=1" />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
          Create your shop
        </Link>
      </p>
    </>
  );
}

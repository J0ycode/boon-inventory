import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { getTenantPublicInfo } from "@/features/auth/queries";
import { getSession, getTenantSlug } from "@/lib/session";
import { portalHome } from "@/lib/roles";
import { tenantPath, tenantUrl } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That link is invalid or has expired. Request a new one.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const slug = await getTenantSlug();
  if (!slug) redirect("/");
  const shop = await getTenantPublicInfo(slug);
  if (!shop) notFound();

  const session = await getSession();
  if (session) {
    redirect(
      session.tenant.slug === slug
        ? tenantPath(slug, portalHome(session.role))
        : tenantUrl(session.tenant.slug, portalHome(session.role)),
    );
  }

  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const welcome = params.welcome === "1";
  const email = typeof params.email === "string" ? params.email.slice(0, 254) : undefined;

  return (
    <>
      {welcome && (
        <p role="status" className="mb-4 rounded-lg bg-mint p-3 text-sm font-semibold text-mint-foreground">
          Your shop is ready. Sign in to get started.
        </p>
      )}
      <h1 className="text-xl font-extrabold tracking-tight">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{shop.name}</p>
      <LoginForm
        demoAccounts={
          process.env.DEMO_LOGIN === "true"
            ? [
                { label: "Owner", email: `owner@${slug}.test` },
                { label: "Store Room Manager", email: `storeroom@${slug}.test` },
                { label: "Store A staff", email: `storea@${slug}.test` },
                { label: "Store B staff", email: `storeb@${slug}.test` },
              ]
            : undefined
        }
        initialEmail={email} next={next} initialError={error} resetHref={tenantPath(slug, "/reset-password")} />
    </>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetRequestForm } from "@/features/auth/reset-request-form";
import { getTenantSlug } from "@/lib/session";
import { tenantPath } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage() {
  const slug = await getTenantSlug();
  if (!slug) redirect("/");
  return (
    <>
      <h1 className="text-xl font-extrabold tracking-tight">Reset your password</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Enter your email and we&apos;ll send you a link to choose a new password.
      </p>
      <ResetRequestForm loginHref={tenantPath(slug, "/login")} />
    </>
  );
}

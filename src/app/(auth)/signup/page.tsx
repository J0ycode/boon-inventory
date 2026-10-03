import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/features/auth/signup-form";
import { getTenantSlug } from "@/lib/session";

export const metadata: Metadata = { title: "Create your shop" };

/** Root-domain signup: creates the owner's login and a new shop with a Store Room and first Store. */
export default async function SignupPage() {
  if (await getTenantSlug()) redirect("/");
  return (
    <>
      <h1 className="text-xl font-extrabold tracking-tight">Create your shop</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Set up stock tracking for your Store Room and stores.</p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have a shop?{" "}
        <Link href="/" className="font-semibold text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

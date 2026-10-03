import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/features/auth/update-password-form";

export const metadata: Metadata = { title: "Choose a password" };

/** Reached from an invite or reset email via /auth/confirm, which signs the user in first. */
export default function UpdatePasswordPage() {
  return (
    <>
      <h1 className="text-xl font-extrabold tracking-tight">Choose a password</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Use at least 8 characters.</p>
      <UpdatePasswordForm />
    </>
  );
}

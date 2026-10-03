"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEMO_PASSWORD = "123";
import { FormError, SubmitButton, TextField } from "@/components/shared/form-fields";
import { signIn } from "./actions";
import { loginSchema } from "./schemas";

export function LoginForm({
  next,
  initialError,
  resetHref,
  initialEmail = "",
  demoAccounts,
}: {
  /** Local demo only (DEMO_LOGIN=true): pick an account to fill in the form. */
  demoAccounts?: { label: string; email: string }[];
  initialEmail?: string;
  next?: string;
  initialError?: string;
  resetHref: string;
}) {
  const [error, setError] = useState<string | undefined>(initialError);
  const [pending, startTransition] = useTransition();
  const [navigating, setNavigating] = useState(false);
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: initialEmail, password: "" } });

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(undefined);
          const result = await signIn({ ...values, next });
          if (result.ok) {
            setNavigating(true);
            window.location.assign(result.redirectTo);
          } else setError(result.error);
        }),
      )}
    >
      <FieldGroup>
        <FormError message={error} />
        {demoAccounts && (
          <Field>
            <FieldLabel htmlFor="demo-account">Demo account</FieldLabel>
            <Select
              onValueChange={(email) => {
                form.setValue("email", email, { shouldValidate: true });
                form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
              }}
            >
              <SelectTrigger id="demo-account" className="w-full">
                <SelectValue placeholder="Choose who to sign in as" />
              </SelectTrigger>
              <SelectContent>
                {demoAccounts.map((a) => (
                  <SelectItem key={a.email} value={a.email}>
                    {a.label} · {a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <TextField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
        />
        <TextField
          control={form.control}
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
        />
        <SubmitButton pending={pending || navigating} size="lg" className="w-full">
          Sign in
        </SubmitButton>
        <Link
          href={resetHref}
          className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary hover:underline"
        >
          Forgot your password?
        </Link>
      </FieldGroup>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEMO_PASSWORD = "123";
import { FormError, SubmitButton, TextField } from "@/components/shared/form-fields";
import { signIn } from "./actions";
import { forgetAccount, rememberAccount, useRecentAccounts } from "./recent-accounts";
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
  const recent = useRecentAccounts();
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: initialEmail, password: "" } });
  const email = useWatch({ control: form.control, name: "email" });

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(undefined);
          const result = await signIn({ ...values, next });
          if (result.ok) {
            rememberAccount(values.email);
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
        {!demoAccounts && recent.length > 0 && (
          <Field>
            <FieldLabel htmlFor="recent-account">Account</FieldLabel>
            <Select
              onValueChange={(email) => {
                form.setValue("email", email, { shouldValidate: true });
                form.setValue("password", "");
                form.setFocus("password");
              }}
            >
              <SelectTrigger id="recent-account" className="w-full">
                <SelectValue placeholder="Choose your account" />
              </SelectTrigger>
              <SelectContent>
                {recent.map((email) => (
                  <SelectItem key={email} value={email}>
                    {email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Accounts that signed in on this device.{" "}
              {email && recent.includes(email) && (
                <button
                  type="button"
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    forgetAccount(form.getValues("email"));
                    form.setValue("email", "");
                  }}
                >
                  Remove this account from this device
                </button>
              )}
            </p>
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

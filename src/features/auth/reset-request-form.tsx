"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { FieldGroup } from "@/components/ui/field";
import { FormError, SubmitButton, TextField } from "@/components/shared/form-fields";
import { requestPasswordReset } from "./actions";
import { resetRequestSchema } from "./schemas";

export function ResetRequestForm({ loginHref }: { loginHref: string }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const form = useForm({ resolver: zodResolver(resetRequestSchema), defaultValues: { email: "" } });

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <MailCheck className="size-8 text-primary" aria-hidden />
        <p className="text-sm">
          If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. Check your inbox.
        </p>
        <Link href={loginHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(undefined);
          const result = await requestPasswordReset(values);
          if (result.ok) setSentTo(values.email);
          else setError(result.error);
        }),
      )}
    >
      <FieldGroup>
        <FormError message={error} />
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
        <SubmitButton pending={pending} size="lg" className="w-full">
          Send reset link
        </SubmitButton>
        <Link
          href={loginHref}
          className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary hover:underline"
        >
          Back to sign in
        </Link>
      </FieldGroup>
    </form>
  );
}

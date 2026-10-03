"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldGroup } from "@/components/ui/field";
import { FormError, SubmitButton, TextField } from "@/components/shared/form-fields";
import { updatePassword } from "./actions";
import { updatePasswordSchema } from "./schemas";

export function UpdatePasswordForm() {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const form = useForm({ resolver: zodResolver(updatePasswordSchema), defaultValues: { password: "", confirm: "" } });

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(undefined);
          const result = await updatePassword(values);
          if (result && !result.ok) setError(result.error);
        }),
      )}
    >
      <FieldGroup>
        <FormError message={error} />
        <TextField
          control={form.control}
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
        />
        <TextField
          control={form.control}
          name="confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
        />
        <SubmitButton pending={pending} size="lg" className="w-full">
          Save password
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

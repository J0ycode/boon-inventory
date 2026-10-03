"use client";

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Labelled text input bound to React Hook Form. Every input in the app has a visible label, an error slot
 * announced to screen readers, and the right `type` / `inputMode` so phones show the correct keyboard.
 */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  ...inputProps
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: React.ReactNode;
} & Omit<React.ComponentProps<typeof Input>, "name" | "value" | "onChange" | "onBlur" | "id">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const id = `field-${name}`;
        const descId = description ? `${id}-desc` : undefined;
        return (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
              {...inputProps}
              {...field}
              value={field.value ?? ""}
              id={id}
              aria-invalid={fieldState.invalid || undefined}
              aria-describedby={descId}
            />
            {description && <FieldDescription id={descId}>{description}</FieldDescription>}
            <FieldError errors={[fieldState.error]} />
          </Field>
        );
      }}
    />
  );
}

/** Submit button that shows a spinner and stays disabled while the action runs (no double submits). */
export function SubmitButton({
  pending,
  children,
  ...props
}: { pending: boolean } & React.ComponentProps<typeof Button>) {
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled} aria-busy={pending || undefined}>
      {pending && <LoaderCircle className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

/** Form-level error (e.g. the server rejected the action). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-danger-foreground">
      {message}
    </p>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FieldGroup } from "@/components/ui/field";
import { FormError, SubmitButton, TextField } from "@/components/shared/form-fields";
import { saveCompany } from "./actions";
import { companySchema, type CompanyValues } from "./schemas";

type Values = CompanyValues;

export function CompanyForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({ resolver: zodResolver(companySchema), defaultValues: initial });

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(undefined);
          const r = await saveCompany(values);
          if (!r.ok) return setError(r.error);
          toast.success("Company details saved");
          router.refresh();
        }),
      )}
    >
      <FieldGroup>
        <FormError message={error} />
        <TextField control={form.control} name="name" label="Shop name (shown in the app)" autoComplete="organization" />
        <TextField control={form.control} name="legalName" label="Legal name (on documents)" autoComplete="off" />
        <TextField control={form.control} name="address" label="Address" autoComplete="street-address" />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField control={form.control} name="phone" label="Phone" type="tel" inputMode="tel" autoComplete="tel" />
          <TextField control={form.control} name="email" label="Email" type="email" inputMode="email" autoComplete="email" />
        </div>
        <TextField control={form.control} name="taxId" label="GSTIN (optional)" autoComplete="off" autoCapitalize="characters" />
        <SubmitButton pending={pending} className="self-start">
          Save
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

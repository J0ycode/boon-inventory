"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FormError, SubmitButton, TextField } from "@/components/shared/form-fields";
import { saveSupplier } from "./actions";
import { supplierSchema, type SupplierFormValues } from "./schemas";

export function SupplierDialog({ trigger, initial }: { trigger: React.ReactNode; initial?: SupplierFormValues }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: initial ?? { id: null, name: "", phone: "", email: "", address: "", active: true },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) {
          setError(undefined);
          form.reset(initial ?? { id: null, name: "", phone: "", email: "", address: "", active: true });
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit supplier" : "Add supplier"}</DialogTitle>
          <DialogDescription className="sr-only">Supplier contact details</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit((values) =>
            startTransition(async () => {
              const result = await saveSupplier(values);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              toast.success(initial ? "Supplier saved" : "Supplier added");
              setOpen(false);
              router.refresh();
            }),
          )}
        >
          <FieldGroup>
            <FormError message={error} />
            <TextField control={form.control} name="name" label="Name" autoComplete="organization" />
            <TextField
              control={form.control}
              name="phone"
              label="Phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
            />
            <TextField
              control={form.control}
              name="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
            />
            <TextField control={form.control} name="address" label="Address" autoComplete="street-address" />
            {initial && (
              <Controller
                control={form.control}
                name="active"
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <Checkbox
                      id="supplier-active"
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                    <FieldLabel htmlFor="supplier-active" className="font-normal">
                      Active
                    </FieldLabel>
                  </Field>
                )}
              />
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <SubmitButton pending={pending}>{initial ? "Save" : "Add supplier"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

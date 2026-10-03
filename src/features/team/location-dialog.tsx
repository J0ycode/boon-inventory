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
import { saveLocation } from "./actions";
import { locationSchema, type LocationFormValues } from "./schemas";

const EMPTY: LocationFormValues = { id: null, name: "", address: "", active: true };

export function LocationDialog({
  trigger,
  initial,
  isStoreRoom = false,
}: {
  trigger: React.ReactNode;
  initial?: LocationFormValues;
  isStoreRoom?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const form = useForm<LocationFormValues>({ resolver: zodResolver(locationSchema), defaultValues: initial ?? EMPTY });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) {
          setError(undefined);
          form.reset(initial ?? EMPTY);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "Add a store"}</DialogTitle>
          <DialogDescription className="sr-only">Location details</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit((values) =>
            startTransition(async () => {
              const result = await saveLocation(values);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              toast.success(initial ? "Saved" : "Store added");
              setOpen(false);
              router.refresh();
            }),
          )}
        >
          <FieldGroup>
            <FormError message={error} />
            <TextField control={form.control} name="name" label="Name" autoComplete="off" />
            <TextField control={form.control} name="address" label="Address" autoComplete="street-address" />
            {initial && !isStoreRoom && (
              <Controller
                control={form.control}
                name="active"
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <Checkbox
                      id="location-active"
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                    <FieldLabel htmlFor="location-active" className="font-normal">
                      Open (active)
                    </FieldLabel>
                  </Field>
                )}
              />
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <SubmitButton pending={pending}>{initial ? "Save" : "Add store"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

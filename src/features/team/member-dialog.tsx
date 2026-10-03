"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError, SubmitButton, TextField } from "@/components/shared/form-fields";
import { inviteMember, updateMember } from "./actions";
import { memberSchema, type MemberFormValues } from "./schemas";

const EMPTY: MemberFormValues = {
  userId: null,
  fullName: "",
  email: "",
  role: "STORE_STAFF",
  locationId: "",
  active: true,
};

export function MemberDialog({
  trigger,
  initial,
  stores,
}: {
  trigger: React.ReactNode;
  initial?: MemberFormValues;
  stores: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const form = useForm<MemberFormValues>({ resolver: zodResolver(memberSchema), defaultValues: initial ?? EMPTY });
  const role = useWatch({ control: form.control, name: "role" });
  const isNew = !initial;

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
          <DialogTitle>{isNew ? "Invite a team member" : `Edit ${initial.fullName}`}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "They'll get an email with a link to choose a password."
              : "Changes apply the next time they load a page."}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit((values) =>
            startTransition(async () => {
              const result = isNew ? await inviteMember(values) : await updateMember(values);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              toast.success(isNew ? `Invite sent to ${values.email}` : "Saved");
              setOpen(false);
              router.refresh();
            }),
          )}
        >
          <FieldGroup>
            <FormError message={error} />
            <TextField control={form.control} name="fullName" label="Name" autoComplete="off" />
            <TextField
              control={form.control}
              name="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="off"
              disabled={!isNew}
            />
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="member-role">Role</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="member-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STORE_STAFF">Store Staff</SelectItem>
                      <SelectItem value="STOREROOM_MANAGER">Store Room Manager</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {field.value === "STORE_STAFF"
                      ? "Works in one store: sees only that store's stock."
                      : "Runs the Store Room: receiving, dispatch, approvals, products."}
                  </FieldDescription>
                </Field>
              )}
            />
            {role === "STORE_STAFF" && (
              <Controller
                control={form.control}
                name="locationId"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="member-store">Store</FieldLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="member-store"
                        className="w-full"
                        aria-invalid={fieldState.invalid || undefined}
                      >
                        <SelectValue placeholder="Choose a store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            )}
            {!isNew && (
              <Controller
                control={form.control}
                name="active"
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <Checkbox
                      id="member-active"
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                    <FieldLabel htmlFor="member-active" className="font-normal">
                      Can sign in
                      <FieldDescription className="block">
                        Turn off when someone leaves. Their history is kept.
                      </FieldDescription>
                    </FieldLabel>
                  </Field>
                )}
              />
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <SubmitButton pending={pending}>{isNew ? "Send invite" : "Save"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

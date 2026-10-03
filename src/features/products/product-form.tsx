"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError, SubmitButton, TextField } from "@/components/shared/form-fields";
import { StickyActionBar } from "@/components/shared/page-header";
import { useTenantHref } from "@/components/shell/tenant-context";
import { saveProduct } from "./actions";
import { productSchema, type ProductFormValues } from "./schemas";

const NO_SUPPLIER = "__none";

export function ProductForm({
  initial,
  suppliers,
}: {
  initial?: ProductFormValues;
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const href = useTenantHref();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: initial ?? {
      id: null,
      name: "",
      category: "CLOTHING",
      sku: "",
      barcode: "",
      sellingPrice: "",
      costPrice: "",
      reorderLevel: "0",
      supplierId: "",
      active: true,
    },
  });
  const isNew = !initial?.id;

  return (
    <form
      noValidate
      className="max-w-2xl"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(undefined);
          const result = await saveProduct(values);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          toast.success(isNew ? "Product added" : "Product saved");
          router.push(href(`/storeroom/products/${result.data.id}`));
          router.refresh();
        }),
      )}
    >
      <FieldGroup>
        <FormError message={error} />
        <TextField control={form.control} name="name" label="Product name" autoComplete="off" maxLength={160} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="category"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="field-category">Category</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="field-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLOTHING">Clothing</SelectItem>
                    <SelectItem value="ACCESSORY">Accessory</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="supplierId"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="field-supplier">Supplier</FieldLabel>
                <Select
                  value={field.value || NO_SUPPLIER}
                  onValueChange={(v) => field.onChange(v === NO_SUPPLIER ? "" : v)}
                >
                  <SelectTrigger id="field-supplier" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SUPPLIER}>No supplier</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="sellingPrice"
            label="Selling price (₹)"
            inputMode="decimal"
            autoComplete="off"
          />
          <TextField
            control={form.control}
            name="costPrice"
            label="Cost price (₹)"
            inputMode="decimal"
            autoComplete="off"
            description="Only owners and Store Room managers can see this."
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="sku"
            label="SKU"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            description={isNew ? "Leave blank to generate one." : undefined}
          />
          <TextField
            control={form.control}
            name="barcode"
            label="Barcode"
            autoComplete="off"
            spellCheck={false}
            description={isNew ? "Scan an existing barcode, or leave blank to generate one." : undefined}
          />
        </div>

        <TextField
          control={form.control}
          name="reorderLevel"
          label="Reorder level (pieces)"
          inputMode="numeric"
          autoComplete="off"
          description="Stores at or below this many pieces show as low stock and get restock suggestions. 0 turns this off."
        />

        {!isNew && (
          <Controller
            control={form.control}
            name="active"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox id="field-active" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                <FieldLabel htmlFor="field-active" className="font-normal">
                  Active
                  <FieldDescription className="block">
                    Inactive products are hidden from lists and scanning.
                  </FieldDescription>
                </FieldLabel>
              </Field>
            )}
          />
        )}
      </FieldGroup>
      <StickyActionBar>
        <SubmitButton pending={pending}>{isNew ? "Add product" : "Save changes"}</SubmitButton>
      </StickyActionBar>
    </form>
  );
}

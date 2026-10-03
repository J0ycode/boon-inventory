"use client";

import { useState, useTransition } from "react";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormError, SubmitButton } from "@/components/shared/form-fields";
import { ROOT_DOMAIN, TENANT_MODE } from "@/lib/tenant/resolve";
import { findShop } from "./find-shop-action";

export function FindShopForm() {
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(undefined);
          const result = await findShop(slug);
          if (result.ok) window.location.assign(result.url);
          else setError(result.error);
        });
      }}
    >
      <FieldGroup>
        <FormError message={error} />
        <Field>
          <FieldLabel htmlFor="shop-slug">Shop address</FieldLabel>
          <Input
            id="shop-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="yourshop"
            aria-describedby="shop-slug-desc"
          />
          <FieldDescription id="shop-slug-desc">
            {TENANT_MODE === "path" ? `${ROOT_DOMAIN}/t/yourshop` : `yourshop.${ROOT_DOMAIN}`}
          </FieldDescription>
        </Field>
        <SubmitButton pending={pending} size="lg" className="w-full" disabled={slug.length < 3}>
          Continue
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormError, SubmitButton } from "@/components/shared/form-fields";
import { isValidSlug, ROOT_DOMAIN, TENANT_MODE } from "@/lib/tenant/resolve";
import { checkSlug, signUp } from "./signup-action";

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

export function SignupForm() {
  const [form, setForm] = useState({
    ownerName: "",
    shopName: "",
    slug: "",
    storeName: "Store A",
    email: "",
    password: "",
    website: "",
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugCheck, setSlugCheck] = useState<{ slug: string; free: boolean }>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Live "is this address free?" check, debounced.
  useEffect(() => {
    if (!isValidSlug(form.slug)) return;
    let live = true;
    const slug = form.slug;
    const t = setTimeout(async () => {
      const free = await checkSlug(slug);
      if (live) setSlugCheck({ slug, free });
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [form.slug]);
  // Only trust a result for the address currently typed.
  const slugFree = slugCheck?.slug === form.slug && isValidSlug(form.slug) ? slugCheck.free : null;

  const slugInvalid = form.slug.length > 0 && !isValidSlug(form.slug);
  const passwordShort = form.password.length > 0 && form.password.length < 8;
  const ready =
    form.ownerName.trim() && form.shopName.trim() && isValidSlug(form.slug) && slugFree !== false && form.email && form.password.length >= 8;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(undefined);
          const result = await signUp(form);
          if (result.ok) window.location.assign(result.url);
          else setError(result.error);
        });
      }}
    >
      <FieldGroup>
        <FormError message={error} />
        <Field>
          <FieldLabel htmlFor="signup-name">Your name</FieldLabel>
          <Input id="signup-name" value={form.ownerName} onChange={set("ownerName")} autoComplete="name" maxLength={80} />
        </Field>
        <Field>
          <FieldLabel htmlFor="signup-shop">Shop name</FieldLabel>
          <Input
            id="signup-shop"
            value={form.shopName}
            maxLength={80}
            autoComplete="organization"
            onChange={(e) => {
              const shopName = e.target.value;
              setForm((f) => ({ ...f, shopName, slug: slugEdited ? f.slug : toSlug(shopName) }));
            }}
          />
        </Field>
        <Field data-invalid={slugInvalid || slugFree === false || undefined}>
          <FieldLabel htmlFor="signup-slug">Shop address</FieldLabel>
          <Input
            id="signup-slug"
            value={form.slug}
            onChange={(e) => {
              setSlugEdited(true);
              setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32) }));
            }}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="signup-slug-desc"
            aria-invalid={slugInvalid || slugFree === false || undefined}
          />
          <FieldDescription id="signup-slug-desc">
            {TENANT_MODE === "path" ? `${ROOT_DOMAIN}/t/${form.slug || "yourshop"}` : `${form.slug || "yourshop"}.${ROOT_DOMAIN}`}
            {slugFree === true && " · available"}
          </FieldDescription>
          {slugInvalid && <FieldError>3–32 characters: lowercase letters, numbers and hyphens.</FieldError>}
          {slugFree === false && <FieldError>That address is taken. Try another.</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="signup-store">First store name</FieldLabel>
          <Input id="signup-store" value={form.storeName} onChange={set("storeName")} maxLength={60} autoComplete="off" />
          <FieldDescription>Your Store Room is created automatically. You can add more stores later.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="signup-email">Email</FieldLabel>
          <Input id="signup-email" type="email" value={form.email} onChange={set("email")} autoComplete="email" />
        </Field>
        <Field data-invalid={passwordShort || undefined}>
          <FieldLabel htmlFor="signup-password">Password</FieldLabel>
          <Input
            id="signup-password"
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
            aria-invalid={passwordShort || undefined}
          />
          {passwordShort && <FieldError>Use at least 8 characters.</FieldError>}
        </Field>
        <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
          <label htmlFor="signup-website">Website</label>
          <input id="signup-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </div>
        <SubmitButton pending={pending} size="lg" className="w-full" disabled={!ready}>
          Create my shop
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

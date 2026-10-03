import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tenantPath } from "@/lib/tenant/resolve";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ApiKeys } from "@/features/settings/api-keys";
import { CompanyForm } from "@/features/settings/company-form";
import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireRole(["OWNER"]);
  const supabase = await createClient();
  const [{ data: tenant }, { data: keys }] = await Promise.all([
    supabase.from("tenants").select("name, legal_name, address, phone, email, tax_id").eq("id", session.tenant.id).single(),
    supabase
      .from("api_keys")
      .select("id, name, prefix, created_at, last_used_at, revoked_at")
      .order("revoked_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false }),
  ]);
  const endpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sales`;

  return (
    <>
      <PageHeader title="Settings" description="Company details and the sales API." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company details</CardTitle>
            <CardDescription>Shown on dispatch notes, reports, and exports.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm
              initial={{
                name: tenant?.name ?? "",
                legalName: tenant?.legal_name ?? "",
                address: tenant?.address ?? "",
                phone: tenant?.phone ?? "",
                email: tenant?.email ?? "",
                taxId: tenant?.tax_id ?? "",
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sales API keys</CardTitle>
            <CardDescription>Let your billing system reduce store stock when it makes a sale.</CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeys keys={keys ?? []} endpoint={endpoint} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Store IDs for the sales API</CardTitle>
            <CardDescription>Your billing system sends the store&apos;s ID as location_id with each sale.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {session.locations
                .filter((l) => l.kind === "STORE")
                .map((l) => (
                  <li key={l.id} className="flex flex-col gap-1 py-3">
                    <span className="font-semibold">{l.name}</span>
                    <code className="rounded-md bg-muted px-2 py-1 text-xs break-all select-all">{l.id}</code>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Export all data</CardTitle>
            <CardDescription>
              Download everything in your shop (products, stock, every movement, bills, dispatches and the activity
              log) as CSV files in one zip. Keep it as a backup or open it in Excel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <a href={tenantPath(session.tenant.slug, "/owner/settings/export")} download>
                <Download aria-hidden /> Download export (.zip)
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

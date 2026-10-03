import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ImportWizard } from "@/features/products/import-wizard";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Import products" };

export default async function ImportPage() {
  await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  return (
    <>
      <PageHeader
        title="Import products"
        description="Check every row before anything is saved. The import is all-or-nothing."
      />
      <ImportWizard />
    </>
  );
}

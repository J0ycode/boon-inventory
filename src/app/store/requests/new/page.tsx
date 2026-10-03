import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { RequestEditor } from "@/features/restock/request-editor";
import { requireRole } from "@/lib/session";
import { storesOf } from "@/lib/roles";

export const metadata: Metadata = { title: "New restock request" };

export default async function NewRequestPage() {
  const session = await requireRole(["STORE_STAFF"]);
  const store = storesOf(session)[0];
  if (!store) notFound();
  return (
    <>
      <PageHeader title="New restock request" description="Search or scan the products you need and set quantities." />
      <RequestEditor locationId={store.id} />
    </>
  );
}

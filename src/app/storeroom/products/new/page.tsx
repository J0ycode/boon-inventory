import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ProductForm } from "@/features/products/product-form";
import { listSuppliers } from "@/features/products/queries";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const suppliers = await listSuppliers();
  return (
    <>
      <PageHeader
        title="Add product"
        description="Each product gets a unique barcode. Stock is added when you receive it."
      />
      <ProductForm suppliers={suppliers} />
    </>
  );
}

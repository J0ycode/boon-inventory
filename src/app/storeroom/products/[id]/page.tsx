import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MovementList } from "@/components/shared/movement-list";
import { PageHeader } from "@/components/shared/page-header";
import { ProductForm } from "@/features/products/product-form";
import { ProductImage } from "@/features/products/product-image";
import {
  getCost,
  getProduct,
  getProductLevels,
  getProductMovements,
  listSuppliers,
  signImages,
} from "@/features/products/queries";
import { formatQty } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Product" };

export default async function ProductPage({ params }: PageProps<"/storeroom/products/[id]">) {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const product = await getProduct(id);
  if (!product) notFound();

  const [suppliers, cost, levels, movements, images] = await Promise.all([
    listSuppliers({ includeInactive: true }),
    getCost(id),
    getProductLevels(id),
    getProductMovements(id),
    signImages([product.image_path]),
  ]);

  return (
    <>
      <PageHeader title={product.name} description={`SKU ${product.sku} · Barcode ${product.barcode}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <ProductImage
            productId={product.id}
            tenantId={session.tenant.id}
            url={product.image_path ? (images.get(product.image_path) ?? null) : null}
            name={product.name}
            canEdit
          />
          <ProductForm
            suppliers={suppliers}
            initial={{
              id: product.id,
              name: product.name,
              category: product.category,
              sku: product.sku,
              barcode: product.barcode,
              sellingPrice: String(product.selling_price),
              costPrice: cost === null ? "" : String(cost),
              reorderLevel: String(product.reorder_level),
              supplierId: product.supplier_id ?? "",
              active: product.active,
            }}
          />
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Stock by location</CardTitle>
            </CardHeader>
            <CardContent>
              {levels.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not stocked anywhere yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {levels.map((l) => (
                    <li key={l.location?.id} className="flex justify-between py-2 text-sm">
                      <span>{l.location?.name}</span>
                      <span className="font-bold tabular-nums">{formatQty(l.quantity)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent movements</CardTitle>
            </CardHeader>
            <CardContent>
              <MovementList items={movements} showLocation />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

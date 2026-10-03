import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MovementList } from "@/components/shared/movement-list";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusChip } from "@/components/shared/status-chip";
import { ProductImage } from "@/features/products/product-image";
import { getProduct, getProductMovements, signImages } from "@/features/products/queries";
import { CATEGORY_LABELS, formatMoney, formatQty, stockStatus } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { storesOf } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Product" };

export default async function StoreProductPage({ params }: PageProps<"/store/stock/[id]">) {
  const session = await requireRole(["STORE_STAFF"]);
  const { id } = await params;
  const store = storesOf(session)[0];
  if (!store || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const product = await getProduct(id);
  if (!product) notFound();

  const supabase = await createClient();
  const [{ data: level }, movements, images] = await Promise.all([
    supabase.from("stock_levels").select("quantity").eq("product_id", id).eq("location_id", store.id).maybeSingle(),
    getProductMovements(id, store.id, 30),
    signImages([product.image_path]),
  ]);
  const qty = level?.quantity ?? 0;

  return (
    <>
      <PageHeader title={product.name} description={`SKU ${product.sku} · Barcode ${product.barcode}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <ProductImage
            productId={product.id}
            tenantId={session.tenant.id}
            url={product.image_path ? (images.get(product.image_path) ?? null) : null}
            name={product.name}
            canEdit={false}
          />
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={`In stock at ${store.name}`}
              value={formatQty(qty)}
              hint={<StatusChip status={stockStatus(qty, product.reorder_level)} />}
            />
            <StatCard
              label="Selling price"
              value={formatMoney(product.selling_price)}
              hint={CATEGORY_LABELS[product.category]}
            />
          </div>
          {product.reorder_level > 0 && (
            <p className="text-sm text-muted-foreground">Reorder level: {formatQty(product.reorder_level)} pieces.</p>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>History at {store.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <MovementList items={movements} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

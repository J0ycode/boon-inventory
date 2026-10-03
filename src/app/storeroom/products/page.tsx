import type { Metadata } from "next";
import Link from "next/link";
import { FileUp, Plus, Tag, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageActions } from "@/components/shared/page-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StockFilters } from "@/features/products/stock-filters";
import { StockTable } from "@/features/products/stock-table";
import {
  getCosts,
  listStock,
  listSuppliers,
  PAGE_SIZE,
  parseStockParams,
  signImages,
} from "@/features/products/queries";
import { requireRole } from "@/lib/session";
import { storeRoomOf } from "@/lib/roles";
import { tenantPath } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/storeroom/products">) {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const room = storeRoomOf(session)!;
  const filters = parseStockParams(await searchParams);
  const [{ rows, total }, suppliers] = await Promise.all([
    listStock({ ...filters, locationId: room.id }),
    listSuppliers(),
  ]);
  const [images, costs] = await Promise.all([
    signImages(rows.map((r) => r.image_path)),
    getCosts(rows.map((r) => r.id)),
  ]);
  const href = (p: string) => tenantPath(session.tenant.slug, p);
  const filtered = Boolean(filters.q || filters.category || filters.stock || filters.supplierId);

  return (
    <>
      <PageHeader
        title="Products"
        description="Your catalogue with Store Room stock."
        actions={
          <PageActions
            secondary={[
              { href: href("/storeroom/suppliers"), label: "Suppliers", icon: <Truck aria-hidden /> },
              { href: href("/storeroom/labels"), label: "Labels", icon: <Tag aria-hidden /> },
              { href: href("/storeroom/products/import"), label: "Import", icon: <FileUp aria-hidden /> },
            ]}
            primary={
              <Button asChild>
                <Link href={href("/storeroom/products/new")}>
                  <Plus aria-hidden /> Add product
                </Link>
              </Button>
            }
          />
        }
      />
      <StockFilters suppliers={suppliers} />
      <StockTable
        caption="Products and Store Room stock"
        basePath="/storeroom/products"
        showCost
        rows={rows.map((r) => ({
          ...r,
          selling_price: Number(r.selling_price),
          imageUrl: r.image_path ? images.get(r.image_path) : null,
          cost: costs.get(r.id) ?? null,
        }))}
        empty={
          filtered ? (
            <EmptyState title="No products match" description="Try a different search or clear the filters." />
          ) : (
            <EmptyState
              title="No products yet"
              description="Add your first product, or import your catalogue from a spreadsheet."
              action={
                <Button asChild>
                  <Link href={href("/storeroom/products/new")}>
                    <Plus aria-hidden /> Add product
                  </Link>
                </Button>
              }
            />
          )
        }
      />
      <Pagination page={filters.page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}

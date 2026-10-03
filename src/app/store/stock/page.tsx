import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StockFilters } from "@/features/products/stock-filters";
import { StockTable } from "@/features/products/stock-table";
import { listStock, PAGE_SIZE, parseStockParams, signImages } from "@/features/products/queries";
import { requireRole } from "@/lib/session";
import { storesOf } from "@/lib/roles";

export const metadata: Metadata = { title: "My Stock" };

export default async function MyStockPage({ searchParams }: PageProps<"/store/stock">) {
  const session = await requireRole(["STORE_STAFF"]);
  const store = storesOf(session)[0];
  if (!store) {
    return (
      <>
        <PageHeader title="My Stock" />
        <EmptyState title="No store assigned" description="Ask the owner to assign you to a store." />
      </>
    );
  }
  const filters = parseStockParams(await searchParams);
  const { rows, total } = await listStock({ ...filters, locationId: store.id });
  const images = await signImages(rows.map((r) => r.image_path));
  const filtered = Boolean(filters.q || filters.category || filters.stock);

  return (
    <>
      <PageHeader title="My Stock" description={`What's on hand at ${store.name}.`} />
      <StockFilters />
      <StockTable
        caption={`Stock at ${store.name}`}
        basePath="/store/stock"
        rows={rows.map((r) => ({
          ...r,
          selling_price: Number(r.selling_price),
          imageUrl: r.image_path ? images.get(r.image_path) : null,
        }))}
        empty={
          <EmptyState
            title={filtered ? "No products match" : "No products yet"}
            description={
              filtered
                ? "Try a different search or clear the filters."
                : "Products appear here once the Store Room adds them."
            }
          />
        }
      />
      <Pagination page={filters.page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}

import { ScanSearchField } from "@/components/shared/scan-search-field";
import { UrlSelect } from "@/components/shared/url-select";

/** Search + filters for stock lists. Suppliers are only passed for managers. */
export function StockFilters({ suppliers }: { suppliers?: { id: string; name: string }[] }) {
  return (
    <div className="mb-4 flex flex-col gap-2 lg:flex-row">
      <ScanSearchField />
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <UrlSelect
          param="category"
          label="Category"
          allLabel="All categories"
          options={[
            { value: "CLOTHING", label: "Clothing" },
            { value: "ACCESSORY", label: "Accessories" },
          ]}
        />
        <UrlSelect
          param="stock"
          label="Stock level"
          allLabel="All stock levels"
          options={[
            { value: "low", label: "Low stock" },
            { value: "out", label: "Out of stock" },
          ]}
        />
        {suppliers && suppliers.length > 0 && (
          <UrlSelect
            param="supplier"
            label="Supplier"
            allLabel="All suppliers"
            className="col-span-2 sm:w-48"
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />
        )}
      </div>
    </div>
  );
}

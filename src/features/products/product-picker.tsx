"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, LoaderCircle, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QtyStepper } from "@/components/shared/qty-stepper";
import { ScannerSheet } from "@/components/shared/scanner-sheet";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { lookupProduct, searchProducts, type PickResult } from "./actions";

export type PickedProduct = Omit<PickResult, "selling_price"> & { selling_price?: number };

/**
 * Adds products to a document (receipt, dispatch, request, labels):
 * - type to search (debounced), arrow keys + Enter to pick;
 * - a USB scanner types the barcode + Enter → exact match is added at once;
 * - camera button (phones/tablets) opens a continuous scanner with an item card and quantity stepper.
 */
export function ProductPicker({
  locationId,
  stockLabel,
  onAdd,
  label = "Add a product",
}: {
  locationId: string;
  /** e.g. "in Store Room" — shown next to stock counts. Omit to hide stock. */
  stockLabel?: string;
  onAdd: (product: PickedProduct, quantity: number) => void;
  label?: string;
}) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickResult[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const rows = await searchProducts(term, locationId).catch(() => []);
      if (mine !== seq.current) return;
      setResults(rows);
      setActive(0);
      setLoading(false);
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q, locationId]);

  const pick = (p: PickResult, qty = 1) => {
    onAdd(p, qty);
    setQ("");
    setResults([]);
    setOpen(false);
  };

  /** Enter: exact barcode/SKU (scanner) wins; otherwise the highlighted result. */
  const onEnter = async () => {
    const term = q.trim();
    if (!term) return;
    const exact = results.find((r) => r.barcode === term || r.sku.toUpperCase() === term.toUpperCase());
    if (exact) return pick(exact);
    const found = await lookupProduct(term, locationId);
    if (found?.active) return pick({ ...found });
    if (results[active]) return pick(results[active]!);
    toast.error(`No product found for "${term}".`);
  };

  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <label htmlFor={`${listId}-input`} className="sr-only">
          {label}
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          placeholder={`${label}: name, SKU, or scan`}
          className="pr-9 pl-9 xl:pr-9 xl:pl-9"
          value={q}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value.trim()) {
              setResults([]);
              setOpen(false);
            }
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {loading && (
          <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        )}
        {open && q.trim() && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
          >
            {results.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">No products match.</li>
            ) : (
              results.map((r, i) => (
                <li
                  key={r.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(r)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2",
                    i === active && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.sku} · {r.barcode}
                    </span>
                  </span>
                  {stockLabel && (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatQty(r.quantity)} {stockLabel}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <Button type="button" variant="outline" size="icon" className="xl:hidden" aria-label="Scan with camera" onClick={() => setScanOpen(true)}>
        <Camera aria-hidden />
      </Button>
      <ScannerSheet open={scanOpen} onOpenChange={setScanOpen} title="Scan items">
        {(code, reset) => (
          <ScanPickCard
            code={code}
            locationId={locationId}
            stockLabel={stockLabel}
            onAdd={(p, qty) => {
              onAdd(p, qty);
              toast.success(`Added ${qty} × ${p.name}`);
              reset();
            }}
            onCancel={reset}
          />
        )}
      </ScannerSheet>
    </div>
  );
}

function ScanPickCard({
  code,
  locationId,
  stockLabel,
  onAdd,
  onCancel,
}: {
  code: string;
  locationId: string;
  stockLabel?: string;
  onAdd: (p: PickedProduct, qty: number) => void;
  onCancel: () => void;
}) {
  const [product, setProduct] = useState<PickedProduct | null | undefined>(undefined);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let alive = true;
    lookupProduct(code, locationId).then((p) => alive && setProduct(p && p.active ? p : null));
    return () => {
      alive = false;
    };
  }, [code, locationId]);

  if (product === undefined) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden /> Looking up {code}…
      </p>
    );
  }
  if (product === null) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <p>
          No active product has the code <strong className="font-mono">{code}</strong>.
        </p>
        <Button variant="outline" onClick={onCancel}>
          Scan again
        </Button>
      </div>
    );
  }
  return (
    <div role="status" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
      <div>
        <p className="text-lg font-extrabold">{product.name}</p>
        <p className="text-sm text-muted-foreground">
          {product.sku} · {product.barcode}
          {stockLabel ? ` · ${formatQty(product.quantity)} ${stockLabel}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <QtyStepper value={qty} onChange={setQty} min={1} label={`Quantity of ${product.name}`} />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Skip
          </Button>
          <Button onClick={() => onAdd(product, qty)}>
            <Plus aria-hidden /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}

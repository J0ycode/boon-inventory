"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QtyStepper } from "@/components/shared/qty-stepper";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DocLine = {
  product_id: string;
  name: string;
  sku: string;
  quantity: number;
  /** Available stock at the source location (dispatch); shown and used as the max when `limitToAvailable`. */
  available?: number;
  /** Optional unit cost as typed (receipts). */
  unitCost?: string;
};

/** Adds a product or increases its quantity if it's already on the document. */
export function addLine(lines: DocLine[], line: DocLine): DocLine[] {
  const existing = lines.find((l) => l.product_id === line.product_id);
  if (!existing) return [...lines, line];
  return lines.map((l) => (l.product_id === line.product_id ? { ...l, quantity: l.quantity + line.quantity } : l));
}

export const totalPieces = (lines: DocLine[]) => lines.reduce((sum, l) => sum + l.quantity, 0);

/** Editable list of document lines. Stacked rows that read well on phones and as a table-like list on desktop. */
export function LineEditor({
  lines,
  onChange,
  showCost = false,
  limitToAvailable = false,
  emptyText = "No products added yet. Search or scan above.",
}: {
  lines: DocLine[];
  onChange: (lines: DocLine[]) => void;
  showCost?: boolean;
  limitToAvailable?: boolean;
  emptyText?: string;
}) {
  if (lines.length === 0) {
    return <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  const update = (id: string, patch: Partial<DocLine>) =>
    onChange(lines.map((l) => (l.product_id === id ? { ...l, ...patch } : l)));

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {lines.map((l) => {
        const over = limitToAvailable && l.available !== undefined && l.quantity > l.available;
        return (
          <li key={l.product_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1 basis-48">
              <p className="line-clamp-2 font-semibold">{l.name}</p>
              <p className={cn("text-xs text-muted-foreground", over && "font-semibold text-danger-foreground")}>
                {l.sku}
                {l.available !== undefined && ` · ${formatQty(l.available)} available`}
                {over && " — not enough stock"}
              </p>
            </div>
            {showCost && (
              <div className="w-28">
                <label htmlFor={`cost-${l.product_id}`} className="sr-only">
                  Unit cost for {l.name}
                </label>
                <Input
                  id={`cost-${l.product_id}`}
                  inputMode="decimal"
                  placeholder="Cost ₹"
                  value={l.unitCost ?? ""}
                  onChange={(e) => update(l.product_id, { unitCost: e.target.value.replace(/[^\d.]/g, "") })}
                />
              </div>
            )}
            <QtyStepper
              value={l.quantity}
              min={1}
              max={limitToAvailable ? Math.max(1, l.available ?? Infinity) : undefined}
              onChange={(quantity) => update(l.product_id, { quantity })}
              label={`Quantity of ${l.name}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${l.name}`}
              onClick={() => onChange(lines.filter((x) => x.product_id !== l.product_id))}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

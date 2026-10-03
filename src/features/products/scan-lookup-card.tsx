"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/shared/status-chip";
import { formatMoney, formatQty } from "@/lib/format";
import { lookupProduct, type LookupResult } from "./actions";

/** Result panel for the global scanner: what is this item and how many do we have here. */
export function ScanLookupCard({
  code,
  locationId,
  locationName,
  productHref,
  onScanAgain,
  onOpen,
}: {
  code: string;
  locationId?: string;
  locationName?: string;
  productHref: (id: string) => string;
  onScanAgain: () => void;
  onOpen: () => void;
}) {
  const [result, setResult] = useState<LookupResult | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    lookupProduct(code, locationId)
      .then((r) => alive && setResult(r))
      .catch(() => alive && setResult(null));
    return () => {
      alive = false;
    };
  }, [code, locationId]);

  if (result === undefined) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden /> Looking up {code}…
      </p>
    );
  }

  return (
    <div role="status" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
      {result ? (
        <>
          <div>
            <p className="text-lg font-extrabold">{result.name}</p>
            <p className="text-sm text-muted-foreground">
              {result.sku} · {result.barcode} · {formatMoney(result.selling_price)}
            </p>
            {!result.active && <StatusChip tone="neutral">Inactive</StatusChip>}
          </div>
          {locationName && (
            <p className="text-sm">
              In stock at {locationName}:{" "}
              <strong className="text-2xl tabular-nums">{formatQty(result.quantity)}</strong>
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onScanAgain}>
              <ScanBarcode aria-hidden /> Scan again
            </Button>
            <Button asChild>
              <Link href={productHref(result.id)} onClick={onOpen}>
                Open product
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>
            No product has the code <strong className="font-mono">{code}</strong>.
          </p>
          <Button variant="outline" onClick={onScanAgain}>
            <ScanBarcode aria-hidden /> Scan again
          </Button>
        </>
      )}
    </div>
  );
}

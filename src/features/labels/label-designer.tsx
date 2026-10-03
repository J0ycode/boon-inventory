"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, LoaderCircle, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StickyActionBar } from "@/components/shared/page-header";
import { QtyStepper } from "@/components/shared/qty-stepper";
import { useTenantHref } from "@/components/shell/tenant-context";
import { ProductPicker } from "@/features/products/product-picker";
import { formatMoney, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { logLabelPrint } from "./actions";
import { perSheet, placeLabels, PRESETS, SHEET, sheetCount, type PresetId } from "./layout";
import type { LabelProduct } from "./label-pdf";

type Item = { product: LabelProduct; copies: number };

export function LabelDesigner({
  storeRoomId,
  receipts,
  receipt,
}: {
  storeRoomId: string;
  receipts: { id: string; label: string }[];
  /** Pre-filled from ?receipt= (one label per piece received). */
  receipt?: { id: string; items: Item[] };
}) {
  const router = useRouter();
  const href = useTenantHref();
  const [items, setItems] = useState<Item[]>(receipt?.items ?? []);
  const [presetId, setPresetId] = useState<PresetId>(40);
  const [start, setStart] = useState(0);
  const [busy, setBusy] = useState<"print" | "download" | null>(null);

  const preset = PRESETS[presetId];
  const placed = useMemo(
    () => placeLabels(preset, items.map((i) => ({ productId: i.product.id, copies: i.copies })), start),
    [preset, items, start],
  );
  const byId = useMemo(() => new Map(items.map((i) => [i.product.id, i.product])), [items]);

  const run = async (mode: "print" | "download") => {
    setBusy(mode);
    try {
      const { buildLabelPdf, printLabels, downloadLabels } = await import("./label-pdf");
      const { kit, labels } = await buildLabelPdf(
        byId,
        items.map((i) => ({ productId: i.product.id, copies: i.copies })),
        presetId,
        start,
      );
      await (mode === "print" ? printLabels(kit) : downloadLabels(kit));
      await logLabelPrint({
        preset: presetId,
        labelCount: labels,
        productCount: items.length,
        source: receipt ? "RECEIPT" : "PRODUCTS",
        receiptId: receipt?.id ?? null,
      });
    } catch {
      toast.error("Couldn't create the labels. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      <div className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor="labels-receipt">Labels for a recent receipt</FieldLabel>
          <Select
            value={receipt?.id}
            onValueChange={(id) => router.push(href(`/storeroom/labels?receipt=${id}`))}
          >
            <SelectTrigger id="labels-receipt" className="w-full">
              <SelectValue placeholder="Choose a receipt (one label per piece)" />
            </SelectTrigger>
            <SelectContent>
              {receipts.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <ProductPicker
          locationId={storeRoomId}
          label="Add a product"
          onAdd={(p, qty) =>
            setItems((list) => {
              const existing = list.find((i) => i.product.id === p.id);
              if (existing) return list.map((i) => (i.product.id === p.id ? { ...i, copies: i.copies + qty } : i));
              return [...list, { product: { id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, selling_price: p.selling_price ?? 0 }, copies: qty }];
            })
          }
        />

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Add products, or choose a recent receipt.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {items.map((i) => (
              <li key={i.product.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="line-clamp-2 font-semibold">{i.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.product.sku} · {i.product.barcode} · {formatMoney(i.product.selling_price)}
                  </p>
                </div>
                <QtyStepper
                  value={i.copies}
                  min={1}
                  max={1000}
                  onChange={(copies) => setItems((l) => l.map((x) => (x.product.id === i.product.id ? { ...x, copies } : x)))}
                  label={`Labels for ${i.product.name}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${i.product.name}`}
                  onClick={() => setItems((l) => l.filter((x) => x.product.id !== i.product.id))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Field>
          <FieldLabel htmlFor="labels-preset">Sticker sheet</FieldLabel>
          <Select
            value={String(presetId)}
            onValueChange={(v) => {
              setPresetId(Number(v) as PresetId);
              setStart(0);
            }}
          >
            <SelectTrigger id="labels-preset" className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(PRESETS).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel id="start-label">Start position</FieldLabel>
          <FieldDescription>Using a partly used sheet? Tap the first empty sticker.</FieldDescription>
          <div
            role="radiogroup"
            aria-labelledby="start-label"
            className="grid w-full max-w-xs gap-1 rounded-lg border border-border bg-muted p-2"
            style={{ gridTemplateColumns: `repeat(${preset.cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: perSheet(preset) }, (_, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={start === i}
                aria-label={`Start at sticker ${i + 1} (row ${Math.floor(i / preset.cols) + 1}, column ${(i % preset.cols) + 1})`}
                onClick={() => setStart(i)}
                className={cn(
                  "aspect-[2/1] min-h-5 rounded-sm border border-border bg-card",
                  i < start && "bg-muted-foreground/25",
                  i === start && "border-primary bg-primary",
                )}
              />
            ))}
          </div>
        </Field>
      </div>

      <div className="flex flex-col gap-3 xl:sticky xl:top-20 xl:self-start">
        <p className="text-sm font-semibold" role="status">
          {placed.length === 0
            ? "Preview"
            : `${formatQty(placed.length)} labels on ${sheetCount(placed)} sheet${sheetCount(placed) > 1 ? "s" : ""}`}
        </p>
        <SheetPreview placed={placed.filter((l) => l.page === 0)} presetId={presetId} products={byId} />
        <StickyActionBar className="xl:justify-start">
          <Button type="button" variant="outline" disabled={!placed.length || busy !== null} onClick={() => run("download")}>
            {busy === "download" ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />} Download PDF
          </Button>
          <Button type="button" disabled={!placed.length || busy !== null} onClick={() => run("print")}>
            {busy === "print" ? <LoaderCircle className="animate-spin" aria-hidden /> : <Printer aria-hidden />} Print
          </Button>
        </StickyActionBar>
      </div>
    </div>
  );
}

/** Live preview of the first sheet, drawn to scale in SVG (millimetre units). */
function SheetPreview({
  placed,
  presetId,
  products,
}: {
  placed: ReturnType<typeof placeLabels>;
  presetId: PresetId;
  products: Map<string, LabelProduct>;
}) {
  const preset = PRESETS[presetId];
  const bars = useBarcodeSvgs([...new Set(placed.map((l) => products.get(l.productId)?.barcode ?? ""))].filter(Boolean));
  const fs = preset.height < 25 ? 2.1 : 2.6;
  return (
    <svg
      viewBox={`0 0 ${SHEET.width} ${SHEET.height}`}
      className="w-full rounded-lg border border-border bg-white shadow-card"
      role="img"
      aria-label="Preview of the first label sheet"
    >
      {Array.from({ length: perSheet(preset) }, (_, i) => (
        <rect
          key={i}
          x={preset.left + (i % preset.cols) * preset.pitchX}
          y={preset.top + Math.floor(i / preset.cols) * preset.pitchY}
          width={preset.width}
          height={preset.height}
          rx={1.5}
          fill="none"
          stroke="#d8dede"
          strokeWidth={0.3}
        />
      ))}
      {placed.map((l) => {
        const p = products.get(l.productId)!;
        const bar = bars.get(p.barcode);
        return (
          <g key={`${l.page}-${l.index}`} transform={`translate(${l.x + 1.6} ${l.y + 1.6})`} fill="#1f2a2a">
            <text y={fs} fontSize={fs} fontWeight={700}>
              {p.name.length > 34 ? `${p.name.slice(0, 33)}…` : p.name}
            </text>
            <text y={fs * 2.3} fontSize={fs * 0.9} fill="#5b6b6b">
              {p.sku}
            </text>
            <text x={preset.width - 3.2} y={fs * 2.3} fontSize={fs} fontWeight={700} textAnchor="end">
              {formatMoney(p.selling_price)}
            </text>
            {bar && (
              <image
                href={bar}
                x={1}
                y={fs * 2.8}
                width={preset.width - 5.2}
                height={preset.height - 3.2 - fs * 2.8 - fs * 1.2}
                preserveAspectRatio="none"
              />
            )}
            <text x={(preset.width - 3.2) / 2} y={preset.height - 3.6} fontSize={fs * 0.85} textAnchor="middle">
              {p.barcode}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Renders barcode SVGs as data URLs (bwip-js, lazy-loaded) for the preview. */
function useBarcodeSvgs(codes: string[]) {
  const [map, setMap] = useState(new Map<string, string>());
  const key = codes.join("|");
  useEffect(() => {
    let alive = true;
    import("bwip-js/browser").then(({ toSVG }) => {
      const next = new Map<string, string>();
      for (const code of key.split("|").filter(Boolean)) {
        try {
          const svg = toSVG({ bcid: "code128", text: code, height: 10, includetext: false });
          next.set(code, `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
        } catch {
          // Leave the preview blank for codes that can't be encoded; the PDF step reports the error.
        }
      }
      if (alive) setMap(next);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return map;
}

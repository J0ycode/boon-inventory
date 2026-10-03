"use client";

import { MM, newDocument, fitText, pdfText, downloadPdf, openPdf, type PdfKit } from "@/lib/pdf";
import { formatMoney } from "@/lib/format";
import { placeLabels, PRESETS, SHEET, type PresetId } from "./layout";

export type LabelProduct = { id: string; name: string; sku: string; barcode: string; selling_price: number };

/** Code 128 barcode as a PNG (rendered at 4× for crisp printing). */
async function barcodePng(code: string): Promise<string> {
  const { toCanvas } = await import("bwip-js/browser");
  const canvas = document.createElement("canvas");
  toCanvas(canvas, { bcid: "code128", text: code, scale: 4, height: 10, includetext: false, paddingwidth: 0, paddingheight: 0 });
  return canvas.toDataURL("image/png");
}

/**
 * Builds the label sheet PDF. Each label: name (up to 2 lines), price, SKU, barcode with its digits underneath.
 * Positions are millimetres from the top-left of the sheet (PDF origin is bottom-left).
 */
export async function buildLabelPdf(
  products: Map<string, LabelProduct>,
  items: { productId: string; copies: number }[],
  presetId: PresetId,
  startIndex: number,
): Promise<{ kit: PdfKit; labels: number; sheets: number }> {
  const preset = PRESETS[presetId];
  const placed = placeLabels(preset, items, startIndex);
  const kit = await newDocument(`Barcode labels (${presetId} per sheet)`);

  const images = new Map<string, Awaited<ReturnType<PdfKit["doc"]["embedPng"]>>>();
  for (const id of new Set(placed.map((l) => l.productId))) {
    images.set(id, await kit.doc.embedPng(await barcodePng(products.get(id)!.barcode)));
  }

  const pages: ReturnType<PdfKit["doc"]["addPage"]>[] = [];
  const pad = 1.6;
  const small = preset.height < 25;
  const nameSize = small ? 5.6 : 7;
  const metaSize = small ? 5.2 : 6.5;
  const codeSize = small ? 5 : 6;

  for (const label of placed) {
    while (pages.length <= label.page) pages.push(kit.doc.addPage([SHEET.width * MM, SHEET.height * MM]));
    const page = pages[label.page]!;
    const p = products.get(label.productId)!;
    const x = (label.x + pad) * MM;
    const top = (SHEET.height - label.y - pad) * MM; // y of the label's top edge, in PDF coordinates
    const innerW = (preset.width - 2 * pad) * MM;
    const innerH = (preset.height - 2 * pad) * MM;

    // Name: up to two lines.
    const words = pdfText(p.name).split(" ");
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const trial = current ? `${current} ${w}` : w;
      if (kit.bold.widthOfTextAtSize(trial, nameSize) <= innerW || !current) current = trial;
      else {
        lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
    const nameLines = lines.slice(0, 2).map((l, i, arr) => (i === arr.length - 1 && lines.length > 2 ? fitText(kit.bold, `${l}…`, nameSize, innerW) : fitText(kit.bold, l, nameSize, innerW)));
    let y = top - nameSize;
    for (const line of nameLines) {
      page.drawText(line, { x, y, size: nameSize, font: kit.bold, color: kit.black });
      y -= nameSize + 1;
    }

    // Price (bold, right) and SKU (left) on one line.
    const price = pdfText(formatMoney(p.selling_price));
    const priceW = kit.bold.widthOfTextAtSize(price, metaSize + 1);
    page.drawText(fitText(kit.font, p.sku, metaSize, innerW - priceW - 4), { x, y: y - 1, size: metaSize, font: kit.font, color: kit.muted });
    page.drawText(price, { x: x + innerW - priceW, y: y - 1, size: metaSize + 1, font: kit.bold, color: kit.black });

    // Barcode fills the remaining height, digits underneath.
    const bottom = top - innerH;
    const codeTextY = bottom + 0.5;
    const barTop = y - metaSize - 2;
    const barBottom = codeTextY + codeSize + 1;
    const barH = Math.max(6, barTop - barBottom);
    const img = images.get(p.id)!;
    const barW = Math.min(innerW, (img.width / img.height) * barH * 1.8);
    page.drawImage(img, { x: x + (innerW - barW) / 2, y: barBottom, width: barW, height: barH });
    const code = pdfText(p.barcode);
    const codeW = kit.font.widthOfTextAtSize(code, codeSize);
    page.drawText(code, { x: x + (innerW - codeW) / 2, y: codeTextY, size: codeSize, font: kit.font, color: kit.black });
  }

  return { kit, labels: placed.length, sheets: pages.length };
}

export async function printLabels(kit: PdfKit) {
  await openPdf(kit, "barcode-labels.pdf");
}

export async function downloadLabels(kit: PdfKit) {
  await downloadPdf(kit, "barcode-labels.pdf");
}

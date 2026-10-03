"use client";

import type { PDFDocument, PDFFont, PDFPage, RGB } from "pdf-lib";
import { brand } from "@/config/brand";

export const A4 = { width: 595.28, height: 841.89 } as const;
export const MM = 72 / 25.4;

/**
 * The standard PDF fonts only cover WinAnsi (Latin-1 + a few typographic marks). Replace anything else so text never
 * fails to render: ₹ → "Rs ", unknown characters → "?".
 */
const WIN_ANSI_EXTRAS = "–—‘’“”•…€™";
export function pdfText(value: string | null | undefined): string {
  return (value ?? "")
    .replaceAll("₹", "Rs ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, (c) => (WIN_ANSI_EXTRAS.includes(c) ? c : "?"));
}

/** Truncates text with an ellipsis so it fits within `maxWidth` points. */
export function fitText(font: PDFFont, text: string, size: number, maxWidth: number): string {
  let t = pdfText(text);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

export async function newDocument(title: string) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc: PDFDocument = await PDFDocument.create();
  doc.setTitle(pdfText(title));
  doc.setProducer(brand.name);
  doc.setCreator(brand.name);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const hex = brand.colors.primary.replace("#", "");
  const primary: RGB = rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  );
  return { doc, font, bold, rgb, primary, black: rgb(0.12, 0.16, 0.16), muted: rgb(0.4, 0.45, 0.45), line: rgb(0.85, 0.87, 0.87) };
}

export type PdfKit = Awaited<ReturnType<typeof newDocument>>;

/** Brand strip at the top of a document page. Returns the y position below it. */
export function drawHeader(kit: PdfKit, page: PDFPage, shopName: string, title: string, subtitle?: string): number {
  const { width, height } = page.getSize();
  const m = 40;
  page.drawRectangle({ x: m, y: height - m - 22, width: 26, height: 22, color: kit.primary });
  page.drawText(pdfText(brand.logo.mark), { x: m + 4, y: height - m - 16, size: 11, font: kit.bold, color: kit.rgb(1, 1, 1) });
  page.drawText(pdfText(brand.name), { x: m + 34, y: height - m - 9, size: 10, font: kit.bold, color: kit.black });
  page.drawText(pdfText(shopName), { x: m + 34, y: height - m - 21, size: 9, font: kit.font, color: kit.muted });
  page.drawText(fitText(kit.bold, title, 18, width - 2 * m), { x: m, y: height - m - 58, size: 18, font: kit.bold, color: kit.black });
  if (subtitle) {
    page.drawText(fitText(kit.font, subtitle, 10, width - 2 * m), { x: m, y: height - m - 74, size: 10, font: kit.font, color: kit.muted });
  }
  return height - m - (subtitle ? 92 : 76);
}

export type Column = { label: string; width: number; align?: "left" | "right" };

/**
 * Draws a simple table, adding pages as needed (header repeated). Returns the page and y after the last row.
 */
export function drawTable(
  kit: PdfKit,
  first: { page: PDFPage; y: number },
  columns: Column[],
  rows: string[][],
  onNewPage: () => { page: PDFPage; y: number },
) {
  const m = 40;
  const size = 9;
  const rowH = 18;
  let { page, y } = first;

  const header = () => {
    let x = m;
    page.drawRectangle({ x: m, y: y - 5, width: page.getWidth() - 2 * m, height: rowH, color: kit.rgb(0.95, 0.97, 0.97) });
    for (const c of columns) {
      const text = pdfText(c.label.toUpperCase());
      const w = kit.bold.widthOfTextAtSize(text, 7.5);
      page.drawText(text, { x: c.align === "right" ? x + c.width - w - 4 : x + 4, y, size: 7.5, font: kit.bold, color: kit.muted });
      x += c.width;
    }
    y -= rowH;
  };

  header();
  for (const row of rows) {
    if (y < 70) {
      ({ page, y } = onNewPage());
      header();
    }
    let x = m;
    row.forEach((cell, i) => {
      const c = columns[i]!;
      const text = fitText(kit.font, cell, size, c.width - 8);
      const w = kit.font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: c.align === "right" ? x + c.width - w - 4 : x + 4, y, size, font: kit.font, color: kit.black });
      x += c.width;
    });
    page.drawLine({ start: { x: m, y: y - 6 }, end: { x: page.getWidth() - m, y: y - 6 }, thickness: 0.5, color: kit.line });
    y -= rowH;
  }
  return { page, y };
}

/** Page numbers + generated-by footer on every page. */
export function drawFooters(kit: PdfKit, label: string) {
  const pages = kit.doc.getPages();
  pages.forEach((p, i) => {
    const text = pdfText(`${label} · page ${i + 1} of ${pages.length} · ${brand.name}`);
    p.drawText(text, { x: 40, y: 24, size: 7.5, font: kit.font, color: kit.muted });
  });
}

/** Opens the PDF in a new tab (users print from the viewer) and falls back to a download if pop-ups are blocked. */
export async function openPdf(kit: PdfKit, filename: string) {
  const bytes = await kit.doc.save();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const win = window.open(url, "_blank");
  if (!win) downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadPdf(kit: PdfKit, filename: string) {
  const bytes = await kit.doc.save();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

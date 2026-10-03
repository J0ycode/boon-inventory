"use client";

import { A4, drawFooters, drawHeader, drawTable, newDocument, openPdf, pdfText } from "@/lib/pdf";
import { formatDateTime, formatQty } from "@/lib/format";

export type DispatchNoteData = {
  shopName: string;
  number: string;
  status: string;
  from: string;
  to: string;
  createdAt: string;
  dispatchedAt: string | null;
  note: string | null;
  lines: { name: string; sku: string; barcode: string; sent: number; received: number | null }[];
};

/** Printable A4 dispatch note: lines with a "checked" column and signature boxes for both sides. */
export async function openDispatchNote(d: DispatchNoteData) {
  const kit = await newDocument(`Dispatch note ${d.number}`);
  const newPage = () => {
    const page = kit.doc.addPage([A4.width, A4.height]);
    return { page, y: drawHeader(kit, page, d.shopName, `Dispatch note ${d.number}`, `${d.from} → ${d.to}`) };
  };

  let { page, y } = newPage();
  const meta = [
    ["From", d.from],
    ["To", d.to],
    ["Created", formatDateTime(d.createdAt)],
    ["Dispatched", d.dispatchedAt ? formatDateTime(d.dispatchedAt) : "Not sent yet (draft)"],
    ...(d.note ? [["Note", d.note]] : []),
  ];
  for (const [k, v] of meta) {
    page.drawText(pdfText(k), { x: 40, y, size: 9, font: kit.bold, color: kit.muted });
    page.drawText(pdfText(v), { x: 120, y, size: 9, font: kit.font, color: kit.black });
    y -= 14;
  }
  y -= 10;

  const total = d.lines.reduce((s, l) => s + l.sent, 0);
  ({ page, y } = drawTable(
    kit,
    { page, y },
    [
      { label: "#", width: 26 },
      { label: "Product", width: 215 },
      { label: "SKU", width: 80 },
      { label: "Barcode", width: 95 },
      { label: "Sent", width: 45, align: "right" },
      { label: "Checked", width: 54, align: "right" },
    ],
    d.lines.map((l, i) => [
      String(i + 1),
      l.name,
      l.sku,
      l.barcode,
      formatQty(l.sent),
      l.received === null ? "____" : formatQty(l.received),
    ]),
    newPage,
  ));

  if (y < 150) ({ page, y } = newPage());
  page.drawText(pdfText(`Total: ${formatQty(total)} pieces in ${d.lines.length} lines`), {
    x: 40,
    y: y - 6,
    size: 10,
    font: kit.bold,
    color: kit.black,
  });
  y -= 60;
  for (const [i, label] of ["Packed by (Store Room)", "Received by (Store)"].entries()) {
    const x = 40 + i * 270;
    page.drawLine({ start: { x, y }, end: { x: x + 230, y }, thickness: 0.8, color: kit.muted });
    page.drawText(pdfText(`${label} — name, signature, date`), { x, y: y - 12, size: 8, font: kit.font, color: kit.muted });
  }

  drawFooters(kit, `Dispatch note ${d.number}`);
  await openPdf(kit, `dispatch-note-${d.number}.pdf`);
}

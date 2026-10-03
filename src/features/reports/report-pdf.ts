"use client";

import { A4, drawFooters, drawHeader, drawTable, newDocument, type Column } from "@/lib/pdf";
import type { ReportColumn } from "./definitions";

const WIDE = new Set(["product", "note", "reason", "kind"]);

/** Landscape A4 report table; column widths share the page, giving text columns more room. */
export async function buildReportPdf(
  shopName: string,
  title: string,
  subtitle: string,
  columns: ReportColumn[],
  rows: string[][],
): Promise<Uint8Array> {
  const kit = await newDocument(title);
  const size: [number, number] = [A4.height, A4.width];
  const usable = size[0] - 80;
  const weights = columns.map((c) => (WIDE.has(c.key) ? 2.4 : c.format === "datetime" ? 1.5 : 1));
  const unit = usable / weights.reduce((a, b) => a + b, 0);
  const cols: Column[] = columns.map((c, i) => ({ label: c.label, width: weights[i]! * unit, align: c.align }));

  const newPage = () => {
    const page = kit.doc.addPage(size);
    return { page, y: drawHeader(kit, page, shopName, title, subtitle) };
  };
  drawTable(kit, newPage(), cols, rows.length ? rows : [["No rows for these filters."]], newPage);
  drawFooters(kit, title);
  return kit.doc.save();
}

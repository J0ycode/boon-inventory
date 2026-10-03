"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchReportForExport } from "./actions";
import { REPORTS, type ReportFilters, type ReportKind } from "./definitions";
import { formatCell } from "./format-cell";

type Format = "csv" | "xlsx" | "pdf";

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** CSV / Excel / PDF of the whole filtered report (not just the visible page). */
export function ExportButtons({
  kind,
  filters,
  shopName,
  subtitle,
}: {
  kind: ReportKind;
  filters: ReportFilters;
  shopName: string;
  subtitle: string;
}) {
  const [busy, setBusy] = useState<Format | null>(null);
  const def = REPORTS[kind];
  const base = `${def.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${def.dated ? `${filters.from}-to-${filters.to}` : new Date().toISOString().slice(0, 10)}`;

  const run = async (format: Format) => {
    setBusy(format);
    try {
      const result = await fetchReportForExport(kind, filters);
      if (!result.ok) return void toast.error(result.error);
      if (result.truncated) toast.warning("Only the first 10,000 rows were exported. Narrow the filters for the rest.");
      const header = def.columns.map((c) => c.label);
      const body = result.rows.map((r) => def.columns.map((c) => formatCell(r[c.key], c.format, c.key)));

      if (format === "csv") {
        const Papa = (await import("papaparse")).default;
        // BOM so Excel opens UTF-8 (₹, —) correctly.
        save(new Blob(["﻿" + Papa.unparse([header, ...body])], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
      } else if (format === "xlsx") {
        const XLSX = await import("xlsx");
        // Raw numbers for numeric columns so totals and sorting work in Excel.
        const raw = result.rows.map((r) =>
          def.columns.map((c) => (c.format && c.format !== "datetime" && c.format !== "text" ? Number(r[c.key] ?? 0) : formatCell(r[c.key], c.format, c.key))),
        );
        const sheet = XLSX.utils.aoa_to_sheet([header, ...raw]);
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, def.label.slice(0, 31));
        XLSX.writeFile(book, `${base}.xlsx`);
      } else {
        const { buildReportPdf } = await import("./report-pdf");
        const bytes = await buildReportPdf(shopName, def.label, subtitle, def.columns, body);
        save(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${base}.pdf`);
      }
    } catch {
      toast.error("Export failed. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const icon = (f: Format, Icon: typeof FileText) =>
    busy === f ? <LoaderCircle className="animate-spin" aria-hidden /> : <Icon aria-hidden />;

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => run("csv")}>
        {icon("csv", FileDown)} CSV
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => run("xlsx")}>
        {icon("xlsx", FileSpreadsheet)} Excel
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => run("pdf")}>
        {icon("pdf", FileText)} PDF
      </Button>
    </div>
  );
}

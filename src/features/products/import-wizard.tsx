"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/shared/form-fields";
import { StickyActionBar } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { useTenantHref } from "@/components/shell/tenant-context";
import { importProducts, type ImportCheck } from "./actions";
import { IMPORT_COLUMNS, normaliseImportRow, type ImportRow } from "./schemas";

async function readFile(file: File): Promise<Record<string, unknown>[]> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: "greedy" });
    return parsed.data;
  }
  const XLSX = await import("xlsx");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
}

function downloadTemplate() {
  const header = IMPORT_COLUMNS.join(",");
  const example = "Organic Cotton Romper — Mint,Clothing,,,649,310,6,Little Threads Garments";
  const blob = new Blob([`${header}\n${example}\n`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "boonbaby-products-template.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ImportWizard() {
  const router = useRouter();
  const href = useTenantHref();
  const [fileName, setFileName] = useState<string>();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [check, setCheck] = useState<ImportCheck>();
  const [error, setError] = useState<string>();
  const [checking, startChecking] = useTransition();
  const [importing, startImport] = useTransition();

  const onFile = (file: File) =>
    startChecking(async () => {
      setError(undefined);
      setCheck(undefined);
      setFileName(file.name);
      try {
        const parsed = (await readFile(file)).map(normaliseImportRow).filter((r) => Object.values(r).some(Boolean));
        setRows(parsed);
        if (parsed.length === 0) {
          setError("No rows found. Check that the first row has column headers like name and category.");
          return;
        }
        const result = await importProducts(parsed, true);
        if (result.ok) setCheck(result.data);
        else setError(result.error);
      } catch {
        setError("Couldn't read that file. Use .csv or .xlsx.");
      }
    });

  const errorCount = check?.rows.filter((r) => r.errors.length > 0).length ?? 0;
  const creates = check?.rows.filter((r) => r.action === "create").length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-card p-6 sm:flex-row sm:items-center">
        <FileSpreadsheet className="size-8 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{fileName ?? "Choose a spreadsheet"}</p>
          <p className="text-sm text-muted-foreground">
            Columns: {IMPORT_COLUMNS.join(", ")}. Only name and category are required. Existing SKUs are updated.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={downloadTemplate}>
            <Download aria-hidden /> Template
          </Button>
          <Button type="button" variant="outline" asChild>
            <label className="cursor-pointer">
              {checking && <LoaderCircle className="animate-spin" aria-hidden />}
              Choose file
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={checking || importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onFile(file);
                }}
              />
            </label>
          </Button>
        </div>
      </div>

      <FormError message={error} />

      {check && (
        <>
          <p role="status" className="text-sm">
            <strong>{rows.length}</strong> rows · {creates} new · {rows.length - creates} updates ·{" "}
            <strong className={errorCount ? "text-danger-foreground" : undefined}>{errorCount} with errors</strong>
          </p>
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Import preview</caption>
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {check.rows.map((r) => {
                  const row = rows[r.row - 1] ?? {};
                  return (
                    <tr key={r.row} className="align-top">
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{r.row + 1}</td>
                      <td className="px-3 py-2">
                        <span className="block font-semibold">{row.name || "—"}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[row.category, row.sku, row.selling_price && `₹${row.selling_price}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {r.errors.length ? (
                          <ul className="text-danger-foreground">
                            {r.errors.map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        ) : (
                          <StatusChip tone={r.action === "create" ? "mint" : "blue"}>
                            {r.action === "create" ? "New" : "Update"}
                          </StatusChip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <StickyActionBar>
            <Button
              type="button"
              disabled={errorCount > 0 || importing}
              onClick={() =>
                startImport(async () => {
                  const result = await importProducts(rows, false);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  toast.success(`Imported: ${result.data.created} new, ${result.data.updated} updated`);
                  router.push(href("/storeroom/products"));
                })
              }
            >
              {importing && <LoaderCircle className="animate-spin" aria-hidden />}
              {errorCount > 0 ? "Fix errors to import" : `Import ${rows.length} rows`}
            </Button>
          </StickyActionBar>
        </>
      )}
    </div>
  );
}

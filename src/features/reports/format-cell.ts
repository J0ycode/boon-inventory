import { formatDateTime, formatDelta, formatMoney, formatQty } from "@/lib/format";
import { statusLabel } from "@/components/shared/status-chip";
import type { ColumnFormat } from "./definitions";

/** Display text for a report cell; used by the on-screen table and every export format. */
export function formatCell(value: string | number | null | undefined, format: ColumnFormat = "text", key?: string): string {
  if (value === null || value === undefined || value === "") return "";
  switch (format) {
    case "qty":
      return formatQty(Number(value));
    case "delta":
      return formatDelta(Number(value));
    case "money":
      return formatMoney(value);
    case "datetime":
      return formatDateTime(String(value));
    default:
      return key === "type" || (key === "status" && /^[A-Z_]+$/.test(String(value))) ? statusLabel(String(value)) : String(value);
  }
}

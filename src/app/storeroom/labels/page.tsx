import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { LabelDesigner } from "@/features/labels/label-designer";
import { getReceipt, listRecentReceipts } from "@/features/receipts/queries";
import { formatDate } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { storeRoomOf } from "@/lib/roles";

export const metadata: Metadata = { title: "Barcode Labels" };

export default async function LabelsPage({ searchParams }: PageProps<"/storeroom/labels">) {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const sp = await searchParams;
  const receiptId = typeof sp.receipt === "string" && /^[0-9a-f-]{36}$/i.test(sp.receipt) ? sp.receipt : null;
  const [recent, receipt] = await Promise.all([listRecentReceipts(20), receiptId ? getReceipt(receiptId) : null]);

  // Selling prices for the receipt's products (receipt lines only carry product id/name/sku/barcode).
  let prefill: { id: string; items: { product: { id: string; name: string; sku: string; barcode: string; selling_price: number }; copies: number }[] } | undefined;
  if (receipt) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const ids = receipt.receipt_lines.map((l) => l.product!.id);
    const { data: prices } = await supabase.from("products").select("id, selling_price").in("id", ids);
    const priceOf = new Map((prices ?? []).map((p) => [p.id, Number(p.selling_price)]));
    prefill = {
      id: receipt.id,
      items: receipt.receipt_lines.map((l) => ({
        product: { ...l.product!, selling_price: priceOf.get(l.product!.id) ?? 0 },
        copies: l.quantity,
      })),
    };
  }

  return (
    <>
      <PageHeader title="Barcode Labels" description="Print labels with name, price, SKU, and barcode on A4 sticker sheets." />
      <LabelDesigner
        key={receiptId ?? "manual"}
        storeRoomId={storeRoomOf(session)!.id}
        receipt={prefill}
        receipts={recent.map((r) => ({
          id: r.id,
          label: `${r.number} · ${r.supplier?.name ?? ""} · ${formatDate(r.created_at)} · ${r.pieces} pcs`,
        }))}
      />
    </>
  );
}

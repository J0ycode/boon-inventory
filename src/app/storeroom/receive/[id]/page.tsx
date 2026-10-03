import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackagePlus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { BillPanel } from "@/features/receipts/bill-panel";
import { getReceipt, signBill } from "@/features/receipts/queries";
import { formatDateTime, formatMoney, formatQty } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { tenantPath } from "@/lib/tenant/resolve";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: PageProps<"/storeroom/receive/[id]">) {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const receipt = await getReceipt(id);
  if (!receipt) notFound();
  const href = (p: string) => tenantPath(session.tenant.slug, p);
  const pieces = receipt.receipt_lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <>
      <PageHeader
        title={`Receipt ${receipt.number}`}
        description={`${receipt.supplier?.name} · invoice ${receipt.invoice_number} · ${formatDateTime(receipt.created_at)}${
          receipt.creator ? ` · by ${receipt.creator.full_name}` : ""
        }`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={href(`/storeroom/labels?receipt=${receipt.id}`)}>
                <Tag aria-hidden /> Print labels
              </Link>
            </Button>
            <Button asChild>
              <Link href={href("/storeroom/receive")}>
                <PackagePlus aria-hidden /> New receipt
              </Link>
            </Button>
          </>
        }
      />
      {receipt.note && <p className="mb-4 text-sm">Note: {receipt.note}</p>}
      <BillPanel
        bill={{
          id: receipt.id,
          tenantId: session.tenant.id,
          status: receipt.payment_status,
          dueDate: receipt.payment_due_date,
          paidAt: receipt.paid_at,
          amount: receipt.bill_amount === null ? null : Number(receipt.bill_amount),
          billUrl: await signBill(receipt.bill_path),
          hasBill: Boolean(receipt.bill_path),
        }}
      />
      <Card>
        <CardContent>
          <ul className="divide-y divide-border">
            {receipt.receipt_lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{l.product?.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {l.product?.sku} · {l.product?.barcode}
                    {l.unit_cost !== null ? ` · cost ${formatMoney(l.unit_cost)}` : ""}
                  </span>
                </span>
                <span className="font-bold tabular-nums">+{formatQty(l.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-right font-bold">Total {formatQty(pieces)} pieces</p>
        </CardContent>
      </Card>
    </>
  );
}

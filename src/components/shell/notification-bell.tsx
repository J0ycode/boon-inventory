"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchNotifications } from "@/features/dashboard/actions";
import type { NotificationSummary } from "@/features/dashboard/queries";
import { formatQty } from "@/lib/format";
import { useSession, useTenantHref } from "./tenant-context";

type Item = { key: keyof NotificationSummary; label: (n: number) => string; href: string };

const STAFF_ITEMS: Item[] = [
  { key: "incoming", label: (n) => `${n} deliver${n === 1 ? "y" : "ies"} to confirm`, href: "/store/incoming" },
  { key: "suggestions", label: () => "Restock suggestions waiting for you", href: "/store/requests" },
  { key: "low_stock", label: (n) => `${n} item${n === 1 ? "" : "s"} low in your store`, href: "/store/stock?stock=low" },
];

const MANAGER_ITEMS: Item[] = [
  { key: "requests", label: (n) => `${n} restock request${n === 1 ? "" : "s"} to decide`, href: "/storeroom/requests" },
  { key: "returns", label: (n) => `${n} return${n === 1 ? "" : "s"} / damage report${n === 1 ? "" : "s"} to approve`, href: "/storeroom/returns" },
  { key: "discrepancies", label: (n) => `${n} deliver${n === 1 ? "y" : "ies"} with issues`, href: "/storeroom/returns?show=issues" },
  { key: "low_stock", label: (n) => `${n} item${n === 1 ? "" : "s"} low in the Store Room`, href: "/storeroom/products?stock=low" },
  { key: "bills_overdue", label: (n) => `${n} purchase bill${n === 1 ? "" : "s"} overdue`, href: "/storeroom/bills?status=overdue" },
  { key: "bills_due_soon", label: (n) => `${n} purchase bill${n === 1 ? "" : "s"} due in 3 days`, href: "/storeroom/bills" },
];

/** Low stock, pending approvals, and deliveries to confirm. Refreshes every 60 s and on navigation. */
export function NotificationBell({ initial }: { initial: NotificationSummary }) {
  const session = useSession();
  const href = useTenantHref();
  const pathname = usePathname();
  const [summary, setSummary] = useState(initial);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchNotifications()
        .then((s) => alive && setSummary(s))
        .catch(() => undefined);
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pathname]);

  const items = (session.role === "STORE_STAFF" ? STAFF_ITEMS : MANAGER_ITEMS).filter((i) => (summary[i.key] ?? 0) > 0);
  // Low stock is informational; the badge counts things someone needs to act on.
  const actionable = items.filter((i) => i.key !== "low_stock").reduce((s, i) => s + (summary[i.key] ?? 0), 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label={actionable ? `Notifications: ${actionable} need attention` : "Notifications"}
        >
          <Bell aria-hidden />
          {actionable > 0 && (
            <span className="absolute top-1.5 right-1.5 grid min-w-4.5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white tabular-nums">
              {actionable > 99 ? "99+" : actionable}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 py-1.5 text-sm font-bold">Notifications</p>
        {items.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul>
            {items.map((i) => (
              <li key={i.key}>
                <Link
                  href={href(i.href)}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-accent"
                >
                  <span className="flex-1">{i.label(summary[i.key] ?? 0)}</span>
                  <span className="sr-only">({formatQty(summary[i.key])})</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

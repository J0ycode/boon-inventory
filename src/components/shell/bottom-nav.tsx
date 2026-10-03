"use client";

import { useState } from "react";
import Link from "next/link";
import { Ellipsis, ScanBarcode } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScannerSheet } from "@/components/shared/scanner-sheet";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV, isActive, MORE_EXTRA, NAV, type NavItem, type Portal } from "./nav-config";
import { ScanLookupCard } from "@/features/products/scan-lookup-card";
import { useAppPathname, useSession, useTenantHref } from "./tenant-context";

/** Phone navigation: Home, Stock, raised Scan button, Requests, More. Hidden from md up. */
export function BottomNav({ portal }: { portal: Portal }) {
  const pathname = useAppPathname();
  const href = useTenantHref();
  const session = useSession();
  // Stock shown after a scan: the staff member's store, otherwise the Store Room.
  const scanLocation = session.locations.find((l) => l.kind === (portal === "store" ? "STORE" : "STORE_ROOM"));
  const [moreOpen, setMoreOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const { home, stock, requests } = BOTTOM_NAV[portal];

  const primary = new Set([home.href, stock.href, requests.href]);
  const moreItems = [...NAV[portal], ...MORE_EXTRA[portal]].filter((i) => !primary.has(i.href));
  const moreActive = moreItems.some((i) => isActive(i, pathname));

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
          <li>
            <TabLink item={home} href={href(home.href)} active={isActive(home, pathname)} />
          </li>
          <li>
            <TabLink item={stock} href={href(stock.href)} active={isActive(stock, pathname)} />
          </li>
          <li className="flex justify-center">
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="-mt-6 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-background transition-transform active:scale-95"
              aria-label="Scan a barcode"
            >
              <ScanBarcode className="size-6" aria-hidden />
            </button>
          </li>
          <li>
            <TabLink item={requests} href={href(requests.href)} active={isActive(requests, pathname)} />
          </li>
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={cn(tabClass, moreActive && activeTabClass)}
            >
              <Ellipsis className="size-5" aria-hidden />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription className="sr-only">Other screens</SheetDescription>
          </SheetHeader>
          <ul className="grid gap-1 px-4">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={href(item.href)}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-lg px-3 font-semibold hover:bg-accent",
                      active && "bg-accent text-accent-foreground",
                    )}
                  >
                    <Icon className="size-5 text-muted-foreground" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>

      <ScannerSheet open={scanOpen} onOpenChange={setScanOpen}>
        {(code, reset) => (
          <ScanLookupCard
            code={code}
            locationId={scanLocation?.id}
            locationName={scanLocation?.name}
            productHref={(id) => href(portal === "store" ? `/store/stock/${id}` : `/storeroom/products/${id}`)}
            onScanAgain={reset}
            onOpen={() => setScanOpen(false)}
          />
        )}
      </ScannerSheet>
    </>
  );
}

const tabClass =
  "flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold text-muted-foreground";
const activeTabClass = "text-primary";

function TabLink({ item, href, active }: { item: NavItem; href: string; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(tabClass, active && activeTabClass)}>
      <Icon className="size-5" aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}

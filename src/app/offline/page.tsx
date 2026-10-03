import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { brand } from "@/config/brand";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "You're offline" };
export const dynamic = "force-static";

/** Shown by the service worker when a page can't load without a connection. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground">
        {brand.logo.mark}
      </div>
      <WifiOff className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="max-w-sm text-muted-foreground">
        {brand.shortName} needs a connection to show live stock. Nothing you entered was saved while offline. Check
        your Wi-Fi or mobile data and try again.
      </p>
      <RetryButton />
    </main>
  );
}

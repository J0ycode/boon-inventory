"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Camera, LoaderCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScannerSheet } from "./scanner-sheet";

/**
 * Search box for every inventory list. Writes `?q=` to the URL (debounced 300 ms; Enter applies immediately, which
 * is what a USB scanner sends) and resets pagination. Phones/tablets get a camera button.
 */
export function ScanSearchField({ label = "Search by name, SKU, or barcode" }: { label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [scanOpen, setScanOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keep the box in sync when the URL changes elsewhere (e.g. back button, global scan).
  const urlQ = params.get("q") ?? "";
  const [syncedQ, setSyncedQ] = useState(urlQ);
  if (urlQ !== syncedQ) {
    setSyncedQ(urlQ);
    setValue(urlQ);
  }

  const apply = (q: string) => {
    clearTimeout(timer.current);
    const next = new URLSearchParams(params);
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <div className="relative min-w-0 flex-1">
        <label htmlFor="scan-search" className="sr-only">
          {label}
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="scan-search"
          type="search"
          value={value}
          placeholder={label}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="pr-10 pl-9 xl:pr-10 xl:pl-9"
          onChange={(e) => {
            setValue(e.target.value);
            clearTimeout(timer.current);
            const q = e.target.value;
            timer.current = setTimeout(() => apply(q), 300);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply(value);
            }
          }}
        />
        {pending ? (
          <LoaderCircle
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-label="Searching"
          />
        ) : (
          value && (
            <button
              type="button"
              onClick={() => {
                setValue("");
                apply("");
              }}
              className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" aria-hidden />
            </button>
          )
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="xl:hidden"
        aria-label="Scan with camera"
        onClick={() => setScanOpen(true)}
      >
        <Camera aria-hidden />
      </Button>
      <ScannerSheet
        open={scanOpen}
        onOpenChange={setScanOpen}
        onCode={(code) => {
          setScanOpen(false);
          setValue(code);
          apply(code);
        }}
      />
    </div>
  );
}

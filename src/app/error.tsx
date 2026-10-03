"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown when a page fails to load. Server errors are already reported by instrumentation.ts. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-sm text-muted-foreground">
        This page couldn&apos;t load. Nothing was changed. Try again, and if it keeps happening, tell your shop owner
        {error.digest ? ` (reference ${error.digest})` : ""}.
      </p>
      <Button type="button" onClick={reset}>
        <RotateCw aria-hidden /> Try again
      </Button>
    </main>
  );
}

"use client";

import { useState } from "react";
import { FileText, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { DispatchNoteData } from "./dispatch-note";

export function DispatchNoteButton({ data }: { data: DispatchNoteData }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { openDispatchNote } = await import("./dispatch-note");
          await openDispatchNote(data);
        } catch {
          toast.error("Couldn't create the dispatch note. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <FileText aria-hidden />} Dispatch note
    </Button>
  );
}

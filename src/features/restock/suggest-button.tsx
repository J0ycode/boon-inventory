"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateSuggestions } from "./actions";

/** On-demand version of the nightly suggestion job for the staff member's store. */
export function SuggestButton({ locationId }: { locationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await generateSuggestions(locationId);
          if (!r.ok) return void toast.error(r.error);
          toast.success(
            r.data.lines > 0 ? `${r.data.lines} low-stock items suggested. Review them below.` : "Nothing new to suggest. Stock looks fine.",
          );
          router.refresh();
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />} Suggest restock
    </Button>
  );
}

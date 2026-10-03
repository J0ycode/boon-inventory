"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { setProductImage } from "./actions";

/** Resizes to max 800px WebP in the browser (keeps uploads small on mobile data), then uploads to Storage. */
async function toWebp(file: File, max = 800): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the image."))), "image/webp", 0.85),
  );
}

export function ProductImage({
  productId,
  tenantId,
  url,
  name,
  canEdit,
}: {
  productId: string;
  tenantId: string;
  url: string | null;
  name: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const blob = await toWebp(file);
      const path = `${tenantId}/${productId}-${Date.now()}.webp`;
      const { error } = await createClient()
        .storage.from("product-images")
        .upload(path, blob, { contentType: "image/webp", upsert: false });
      if (error) throw error;
      const result = await setProductImage(productId, path);
      if (!result.ok) throw new Error(result.error);
      toast.success("Photo updated");
      router.refresh();
    } catch {
      toast.error("Couldn't upload the photo. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL
        <img src={url} alt={name} className="size-24 rounded-xl border border-border object-cover" />
      ) : (
        <div
          className="grid size-24 place-items-center rounded-xl bg-muted text-lg font-bold text-muted-foreground"
          aria-hidden
        >
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      {canEdit && (
        <div className="flex flex-col gap-2">
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
            {url ? "Change photo" : "Add photo"}
          </Button>
          {url && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const result = await setProductImage(productId, null);
                setBusy(false);
                if (result.ok) router.refresh();
                else toast.error(result.error);
              }}
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

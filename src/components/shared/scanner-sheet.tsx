"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, ScanBarcode } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type CameraState = "starting" | "scanning" | "denied" | "unavailable";

/**
 * Full-screen barcode scanner for phones and tablets.
 * - Camera scanning with @zxing/browser (rear camera preferred). Works in the installed PWA on Android and iOS Safari
 *   (camera needs HTTPS or localhost).
 * - If the camera is denied or missing, the user can type the code (a USB scanner also types + Enter).
 * - `children(code, reset)` renders the result panel (item card, quantity stepper, …) for the scanned code.
 *   Without children, `onCode` is called and the sheet is expected to close.
 */
export function ScannerSheet({
  open,
  onOpenChange,
  onCode,
  title = "Scan a barcode",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCode?: (code: string) => void;
  title?: string;
  children?: (code: string, reset: () => void) => React.ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const [code, setCode] = useState<string | null>(null);

  const accept = useCallback(
    (value: string) => {
      const clean = value.trim();
      if (!clean) return;
      navigator.vibrate?.(40);
      setCode(clean);
      onCode?.(clean);
    },
    [onCode],
  );

  const reset = useCallback(() => {
    setCode(null);
    setTyped("");
  }, []);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="bottom"
        className="flex h-dvh max-h-dvh flex-col gap-0 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Point the camera at the barcode, or type the code.</SheetDescription>
        </SheetHeader>
        <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
          {open && <CameraView paused={code !== null} onDetected={accept} />}
          {code !== null && children ? (
            children(code, reset)
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                accept(typed);
              }}
            >
              <Label htmlFor="scanner-code">Barcode or SKU</Label>
              <div className="flex gap-2">
                <Input
                  id="scanner-code"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  enterKeyHint="search"
                />
                <Button type="submit" disabled={!typed.trim()}>
                  Find
                </Button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CameraView({ paused, onDetected }: { paused: boolean; onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pausedRef = useRef(paused);
  const onDetectedRef = useRef(onDetected);
  const [state, setState] = useState<CameraState>("starting");

  useEffect(() => {
    pausedRef.current = paused;
    onDetectedRef.current = onDetected;
  });

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        return;
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.CODE_39,
        ]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        if (cancelled || !videoRef.current) return;
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current,
          (result) => {
            if (result && !pausedRef.current) onDetectedRef.current(result.getText());
          },
        );
        if (cancelled) controls.stop();
        else setState("scanning");
      } catch (error) {
        const name = (error as Error)?.name;
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    }

    start();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  if (state === "denied" || state === "unavailable") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl border border-border bg-muted p-4 text-sm">
        <CameraOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <p>
          {state === "denied"
            ? "Camera access is blocked. Allow the camera for this site in your browser settings, or type the code below."
            : "No camera is available here. Type the code below, or use a USB scanner."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} className="size-full object-cover" muted playsInline aria-label="Camera preview" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/80"
      />
      {state === "starting" && (
        <div className="absolute inset-0 grid place-items-center text-white/80">
          <ScanBarcode className="size-10" aria-hidden />
        </div>
      )}
    </div>
  );
}

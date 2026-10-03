"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Whole-piece quantity input with large −/+ buttons. Opens the numeric keypad on phones. */
export function QtyStepper({
  value,
  onChange,
  min = 0,
  max,
  label,
  id,
  className,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Accessible name, e.g. "Quantity for Ribbed Bodysuit". */
  label: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}) {
  const clamp = (n: number) => Math.max(min, max === undefined ? n : Math.min(max, n));

  return (
    <div className={cn("inline-flex items-center gap-1", className)} role="group" aria-label={label}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Decrease"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus aria-hidden />
      </Button>
      <input
        id={id}
        aria-label={label}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        value={String(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(clamp(digits === "" ? min : Number.parseInt(digits, 10)));
        }}
        onFocus={(e) => e.target.select()}
        className="h-11 w-16 rounded-lg border border-input bg-transparent text-center text-base font-bold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 xl:h-9"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Increase"
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}

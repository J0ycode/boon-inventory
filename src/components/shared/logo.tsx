import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/** Text-based logo placeholder. Swap the contents for an <Image> when a real logo arrives (see src/config/brand.ts). */
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-extrabold tracking-tight text-primary-foreground"
      >
        {brand.logo.mark}
      </span>
      <span className={cn("leading-tight", compact && "sr-only")}>
        <span className="block font-extrabold tracking-tight">{brand.logo.wordmark}</span>
        <span className="block text-xs font-semibold text-muted-foreground">{brand.logo.tagline}</span>
      </span>
    </span>
  );
}

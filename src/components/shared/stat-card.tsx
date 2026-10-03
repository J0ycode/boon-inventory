import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A single headline number. Becomes a link when `href` is given (e.g. "Low stock: 12" → filtered list). */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  href?: string;
  tone?: "default" | "warning";
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              "grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground",
              tone === "warning" && "bg-peach text-peach-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums md:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const className = "block rounded-xl border border-border bg-card p-4 shadow-card md:p-5";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:border-ring/60")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

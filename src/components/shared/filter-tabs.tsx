"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Segmented filter bound to one URL param (first option = param absent). Scrolls sideways on narrow phones. */
export function FilterTabs({
  param,
  options,
  label,
}: {
  param: string;
  options: { value: string; label: string; count?: number }[];
  label: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(param) ?? options[0]?.value;

  return (
    <nav aria-label={label} className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="inline-flex gap-1 rounded-xl bg-muted p-1">
        {options.map((o, i) => {
          const sp = new URLSearchParams(params);
          if (i === 0) sp.delete(param);
          else sp.set(param, o.value);
          sp.delete("page");
          const qs = sp.toString();
          const active = current === o.value;
          return (
            <li key={o.value}>
              <Link
                href={qs ? `${pathname}?${qs}` : pathname}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={cn(
                  "flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap text-muted-foreground",
                  active && "bg-card text-foreground shadow-card",
                )}
              >
                {o.label}
                {o.count !== undefined && o.count > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{o.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

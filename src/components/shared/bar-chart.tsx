"use client";

import { useState } from "react";
import { formatQty } from "@/lib/format";

export type BarDatum = { id: string; label: string; value: number; detail?: string };

/**
 * Single-series horizontal bar chart (one hue, so no legend — the title names the measure).
 * Thin bars with 4px rounded data ends anchored at zero, direct value labels, recessive grid, and a per-bar
 * tooltip on hover or keyboard focus. Pair it with a table of the same numbers for a non-visual view.
 */
export function BarChart({ data, title, unit }: { data: BarDatum[]; title: string; unit: string }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1]!;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      <div className="relative">
        {/* grid */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-14 left-28 sm:left-36">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute inset-y-0 border-l border-border"
              style={{ left: `${(t / top) * 100}%` }}
            />
          ))}
        </div>
        <ul className="relative flex flex-col gap-3 py-1">
          {data.map((d) => {
            const pct = (d.value / top) * 100;
            const isActive = active === d.id;
            return (
              <li key={d.id} className="flex items-center gap-2">
                <span className="w-26 shrink-0 truncate text-right text-sm text-muted-foreground sm:w-34">{d.label}</span>
                <div className="relative h-8 flex-1">
                  <button
                    type="button"
                    className="absolute inset-y-0 left-0 flex w-full items-center rounded-r-md focus-visible:outline-2 focus-visible:outline-ring"
                    onMouseEnter={() => setActive(d.id)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(d.id)}
                    onBlur={() => setActive(null)}
                    aria-label={`${d.label}: ${formatQty(d.value)} ${unit}${d.detail ? `, ${d.detail}` : ""}`}
                  >
                    <span
                      className="block h-5 rounded-r-[4px] bg-chart-1 transition-[width] duration-300"
                      style={{ width: `${Math.max(pct, d.value > 0 ? 0.8 : 0)}%` }}
                    />
                  </button>
                  {isActive && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute -top-9 z-10 rounded-md border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
                      style={{ left: `min(${pct}%, calc(100% - 10rem))` }}
                    >
                      <strong className="tabular-nums">{formatQty(d.value)}</strong> {unit}
                      {d.detail && <span className="text-muted-foreground"> · {d.detail}</span>}
                    </span>
                  )}
                </div>
                <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{formatQty(d.value)}</span>
              </li>
            );
          })}
        </ul>
        <div aria-hidden className="relative mr-14 ml-28 h-4 text-[11px] text-muted-foreground sm:ml-36">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${(t / top) * 100}%` }}>
              {formatQty(t)}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

/** 0 plus 3–5 round ticks covering max. */
function niceTicks(max: number): number[] {
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const ticks = [0];
  while (ticks[ticks.length - 1]! < max) ticks.push(ticks[ticks.length - 1]! + step);
  return ticks;
}

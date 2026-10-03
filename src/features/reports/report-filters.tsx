"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UrlSelect } from "@/components/shared/url-select";
import { MOVEMENT_LABELS } from "@/lib/format";

/** Date range (applied together with one button) + location and movement-type filters, all in the URL. */
export function ReportFilters({
  dated,
  from,
  to,
  locations,
  showType,
}: {
  dated: boolean;
  from: string;
  to: string;
  locations: { id: string; name: string }[];
  showType: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [range, setRange] = useState({ from, to });
  const [, startTransition] = useTransition();

  const apply = () => {
    const sp = new URLSearchParams(params);
    sp.set("from", range.from);
    sp.set("to", range.to);
    sp.delete("page");
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  };

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
      {dated && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="report-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="report-from"
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="report-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="report-to"
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="w-40"
            />
          </div>
          <Button type="submit" variant="outline" disabled={!range.from || !range.to}>
            Apply dates
          </Button>
        </form>
      )}
      <div className="grid grid-cols-1 gap-2 sm:flex">
        {locations.length > 1 && (
        <UrlSelect
          param="location"
          label="Location"
          allLabel="All locations"
          className="sm:w-56"
          options={locations.map((l) => ({ value: l.id, label: l.name }))}
        />
        )}
        {showType && (
          <UrlSelect
            param="type"
            label="Movement type"
            allLabel="All movement types"
            className="sm:w-56"
            options={Object.entries(MOVEMENT_LABELS).map(([value, label]) => ({ value, label }))}
          />
        )}
      </div>
    </div>
  );
}

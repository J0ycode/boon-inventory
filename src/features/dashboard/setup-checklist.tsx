import Link from "next/link";
import { ChevronRight, CircleCheck, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { tenantPath } from "@/lib/tenant/resolve";

const STEPS = [
  { key: "suppliers", label: "Add your suppliers", href: "/storeroom/suppliers" },
  { key: "products", label: "Add products (one by one or import a spreadsheet)", href: "/storeroom/products" },
  { key: "received", label: "Receive your first delivery into the Store Room", href: "/storeroom/receive" },
  { key: "team", label: "Invite your Store Room manager and store staff", href: "/owner/team" },
  { key: "dispatched", label: "Send your first dispatch to a store", href: "/storeroom/dispatch" },
] as const;

type Progress = Record<(typeof STEPS)[number]["key"], boolean>;

/** First-run checklist on the owner dashboard. Disappears once every step is done. */
export async function SetupChecklist({ slug }: { slug: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("setup_progress");
  const progress = (data ?? {}) as Partial<Progress>;
  const done = STEPS.filter((s) => progress[s.key]).length;
  if (done === STEPS.length) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Get your shop set up</CardTitle>
        <CardDescription>
          {done} of {STEPS.length} done
        </CardDescription>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={done}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${(done / STEPS.length) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent>
        <ol className="-mx-2">
          {STEPS.map((s) => {
            const complete = Boolean(progress[s.key]);
            return (
              <li key={s.key}>
                <Link
                  href={tenantPath(slug, s.href)}
                  className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent"
                >
                  {complete ? (
                    <CircleCheck className="size-5 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className={complete ? "flex-1 text-muted-foreground line-through" : "flex-1 font-semibold"}>
                    {s.label}
                    <span className="sr-only">{complete ? " (done)" : " (to do)"}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

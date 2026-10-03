"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form-fields";
import { StatusChip } from "@/components/shared/status-chip";
import { formatDateTime } from "@/lib/format";
import { createApiKey, revokeApiKey, rotateApiKey } from "./actions";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

/** Per-tenant API keys for the billing module. The full key is shown exactly once, after create or rotate. */
export function ApiKeys({ keys, endpoint }: { keys: ApiKeyRow[]; endpoint: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const active = keys.filter((k) => !k.revoked_at);

  const show = (key: string) => {
    setRevealed(key);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Your billing system sends sales to <code className="rounded bg-muted px-1.5 py-0.5 text-xs break-all">{endpoint}</code>{" "}
        with <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Authorization: Bearer &lt;key&gt;</code>. Keep keys on your
        server — never in a web page or app.
      </p>
      <FormError message={error} />
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          const r = await createApiKey(name);
          setBusy(false);
          if (!r.ok) return setError(r.error);
          setName("");
          show(r.data.key);
        }}
      >
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="key-name">New key name</Label>
          <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Billing counter" maxLength={60} />
        </div>
        <Button type="submit" disabled={busy || !name.trim()}>
          <Plus aria-hidden /> Create key
        </Button>
      </form>

      {keys.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <KeyRound className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {k.name} <span className="font-mono text-xs text-muted-foreground">bb_live_{k.prefix}_…</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {formatDateTime(k.created_at)} · {k.last_used_at ? `last used ${formatDateTime(k.last_used_at)}` : "never used"}
                </p>
              </div>
              {k.revoked_at ? (
                <StatusChip tone="neutral">Revoked</StatusChip>
              ) : (
                <div className="flex gap-1">
                  <ConfirmDialog
                    title={`Rotate "${k.name}"?`}
                    description="A new key is created and the current one stops working immediately. Update your billing system right away."
                    confirmLabel="Rotate key"
                    onConfirm={async () => {
                      const r = await rotateApiKey(k.id);
                      if (!r.ok) {
                        toast.error(r.error);
                        return false;
                      }
                      show(r.data.key);
                    }}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <RefreshCw aria-hidden /> Rotate
                      </Button>
                    }
                  />
                  <ConfirmDialog
                    destructive
                    title={`Revoke "${k.name}"?`}
                    description="Requests using this key will be refused. This can't be undone."
                    confirmLabel="Revoke"
                    onConfirm={async () => {
                      const r = await revokeApiKey(k.id);
                      if (!r.ok) {
                        toast.error(r.error);
                        return false;
                      }
                      toast.success("Key revoked");
                      router.refresh();
                    }}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Trash2 aria-hidden /> Revoke
                      </Button>
                    }
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {active.length === 0 && <p className="text-sm text-muted-foreground">No active keys. Create one to connect your billing system.</p>}

      <Dialog open={revealed !== null} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your new API key</DialogTitle>
            <DialogDescription>This is the only time it is shown. Store it in your billing system&apos;s settings.</DialogDescription>
          </DialogHeader>
          <code data-testid="new-api-key" className="block rounded-lg bg-muted p-3 font-mono text-sm break-all">
            {revealed}
          </code>
          <DialogFooter>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(revealed ?? "");
                toast.success("Copied");
              }}
            >
              <Copy aria-hidden /> Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

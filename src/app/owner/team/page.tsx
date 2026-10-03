import type { Metadata } from "next";
import { MapPin, Pencil, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { LocationDialog } from "@/features/team/location-dialog";
import { MemberDialog } from "@/features/team/member-dialog";
import { listLocations, listMembers } from "@/features/team/queries";
import { requireRole } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/roles";

export const metadata: Metadata = { title: "Users & Locations" };

export default async function TeamPage() {
  const session = await requireRole(["OWNER"]);
  const [members, locations] = await Promise.all([listMembers(), listLocations()]);
  const stores = locations.filter((l) => l.kind === "STORE" && l.active);
  const nameOf = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <>
      <PageHeader
        title="Users & Locations"
        description="Invite your team and manage your stores."
        actions={
          <MemberDialog
            stores={stores}
            trigger={
              <Button>
                <UserPlus aria-hidden /> Invite
              </Button>
            }
          />
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {members.map((m) => {
                const editable = m.role !== "OWNER";
                const where = m.role === "STORE_STAFF" ? m.location_ids.map((id) => nameOf.get(id)).join(", ") : "";
                return (
                  <li key={m.user_id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {m.full_name}
                        {m.user_id === session.user_id && (
                          <span className="font-normal text-muted-foreground"> (you)</span>
                        )}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <StatusChip
                          tone={m.role === "OWNER" ? "lavender" : m.role === "STOREROOM_MANAGER" ? "blue" : "mint"}
                        >
                          {ROLE_LABELS[m.role]}
                        </StatusChip>
                        {where && <StatusChip tone="neutral">{where}</StatusChip>}
                        {!m.active && <StatusChip tone="danger">Deactivated</StatusChip>}
                      </div>
                    </div>
                    {editable && (
                      <MemberDialog
                        stores={stores}
                        initial={{
                          userId: m.user_id,
                          fullName: m.full_name,
                          email: m.email,
                          role: m.role as "STOREROOM_MANAGER" | "STORE_STAFF",
                          locationId: m.role === "STORE_STAFF" ? (m.location_ids[0] ?? "") : "",
                          active: m.active,
                        }}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Edit ${m.full_name}`}>
                            <Pencil aria-hidden />
                          </Button>
                        }
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Locations</CardTitle>
            <LocationDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Plus aria-hidden /> Add store
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {locations.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-3">
                  <MapPin className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {l.kind === "STORE_ROOM" ? "Store Room" : "Store"}
                      {l.address ? ` · ${l.address}` : ""}
                      {!l.active ? " · Closed" : ""}
                    </p>
                  </div>
                  <LocationDialog
                    isStoreRoom={l.kind === "STORE_ROOM"}
                    initial={{ id: l.id, name: l.name, address: l.address ?? "", active: l.active }}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Edit ${l.name}`}>
                        <Pencil aria-hidden />
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

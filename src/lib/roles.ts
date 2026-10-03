export type AppRole = "OWNER" | "STOREROOM_MANAGER" | "STORE_STAFF";
export type LocationKind = "STORE_ROOM" | "STORE";
export type TenantStatus = "trial" | "active" | "past_due" | "canceled";

export type SessionLocation = { id: string; name: string; kind: LocationKind };

/** Shape returned by the my_context() RPC. */
export type SessionContext = {
  user_id: string;
  full_name: string;
  email: string;
  role: AppRole;
  tenant: { id: string; slug: string; name: string; status: TenantStatus; trial_ends_at: string };
  locations: SessionLocation[];
};

export const ROLE_LABELS: Record<AppRole, string> = {
  OWNER: "Owner",
  STOREROOM_MANAGER: "Store Room Manager",
  STORE_STAFF: "Store Staff",
};

export const storeRoomOf = (s: SessionContext) => s.locations.find((l) => l.kind === "STORE_ROOM");
export const storesOf = (s: SessionContext) => s.locations.filter((l) => l.kind === "STORE");
export const isManager = (role: AppRole) => role === "OWNER" || role === "STOREROOM_MANAGER";

export function portalHome(role: AppRole): "/owner" | "/storeroom" | "/store" {
  switch (role) {
    case "OWNER":
      return "/owner";
    case "STOREROOM_MANAGER":
      return "/storeroom";
    case "STORE_STAFF":
      return "/store";
  }
}

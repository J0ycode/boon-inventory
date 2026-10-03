"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { orNull } from "@/lib/supabase/rpc";
import { getSession, getTenantSlug } from "@/lib/session";
import { toUserMessage } from "@/lib/errors";
import { storeRoomOf } from "@/lib/roles";
import { tenantUrl } from "@/lib/tenant/resolve";
import { locationSchema, memberSchema, type LocationFormValues, type MemberFormValues } from "./schemas";

export type Result = { ok: true } | { ok: false; error: string };

function locationIdsFor(values: MemberFormValues, storeRoomId: string | undefined): string[] {
  if (values.role === "STOREROOM_MANAGER") return storeRoomId ? [storeRoomId] : [];
  return values.locationId ? [values.locationId] : [];
}

/**
 * Invites a team member. Supabase Auth needs admin rights to send invites, so this uses the service-role client —
 * only after confirming the caller is this shop's owner. The DB function re-checks ownership.
 */
export async function inviteMember(values: MemberFormValues): Promise<Result> {
  const parsed = memberSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const session = await getSession();
  const slug = await getTenantSlug();
  if (!session || session.role !== "OWNER" || slug !== session.tenant.slug) {
    return { ok: false, error: "Only the owner can invite people." };
  }
  const v = parsed.data;
  const admin = createAdminClient();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(v.email, {
    redirectTo: tenantUrl(slug, "/auth/confirm"),
    data: { full_name: v.fullName },
  });
  if (inviteError || !invited.user) {
    const exists = inviteError?.message.toLowerCase().includes("already");
    return {
      ok: false,
      error: exists
        ? "This email already has an account. Each person can belong to one shop."
        : "Couldn't send the invite. Check the email address and try again.",
    };
  }

  const { error } = await admin.rpc("admin_add_member", {
    p_owner_id: session.user_id,
    p_user_id: invited.user.id,
    p_full_name: v.fullName,
    p_email: v.email,
    p_role: v.role,
    p_location_ids: locationIdsFor(v, storeRoomOf(session)?.id),
  });
  if (error) {
    // Don't leave an orphaned auth user behind if the shop-side step failed.
    await admin.auth.admin.deleteUser(invited.user.id);
    return { ok: false, error: toUserMessage(error) };
  }
  revalidatePath("/owner/team");
  return { ok: true };
}

export async function updateMember(values: MemberFormValues): Promise<Result> {
  const parsed = memberSchema.safeParse(values);
  if (!parsed.success || !parsed.data.userId) return { ok: false, error: "Check the form." };
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member", {
    p_user_id: v.userId!,
    p_full_name: v.fullName,
    p_role: v.role,
    p_location_ids: locationIdsFor(v, storeRoomOf(session)?.id),
    p_active: v.active,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/owner/team");
  return { ok: true };
}

export async function saveLocation(values: LocationFormValues): Promise<Result> {
  const parsed = locationSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_location", {
    p_id: orNull(v.id),
    p_name: v.name,
    p_address: v.address,
    p_active: v.active,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/owner/team");
  return { ok: true };
}

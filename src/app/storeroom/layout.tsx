import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/session";

export default async function StoreRoomLayout({ children }: LayoutProps<"/storeroom">) {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  return (
    <AppShell session={session} portal="storeroom">
      {children}
    </AppShell>
  );
}

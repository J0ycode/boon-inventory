import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/session";

export default async function StoreLayout({ children }: LayoutProps<"/store">) {
  const session = await requireRole(["STORE_STAFF"]);
  return (
    <AppShell session={session} portal="store">
      {children}
    </AppShell>
  );
}

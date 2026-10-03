import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/session";

export default async function OwnerLayout({ children }: LayoutProps<"/owner">) {
  const session = await requireRole(["OWNER"]);
  return (
    <AppShell session={session} portal="owner">
      {children}
    </AppShell>
  );
}

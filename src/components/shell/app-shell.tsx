import type { SessionContext } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/roles";
import { Logo } from "@/components/shared/logo";
import { BottomNav } from "./bottom-nav";
import type { Portal } from "./nav-config";
import { SideNav } from "./side-nav";
import { TenantProvider } from "./tenant-context";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notification-bell";
import { getNotificationSummary } from "@/features/dashboard/queries";

/** Responsive portal frame: sidebar (desktop) / icon rail (tablet) / bottom nav (phone). */
export async function AppShell({
  session,
  portal,
  children,
}: {
  session: SessionContext;
  portal: Portal;
  children: React.ReactNode;
}) {
  const notifications = await getNotificationSummary();
  const scope =
    session.role === "STORE_STAFF"
      ? session.locations
          .filter((l) => l.kind === "STORE")
          .map((l) => l.name)
          .join(", ")
      : ROLE_LABELS[session.role];

  return (
    <TenantProvider session={session}>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SideNav portal={portal} />
      <div className="flex min-h-dvh flex-col md:pl-20 xl:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 md:h-16 md:px-6 xl:px-8">
            <Logo compact className="md:hidden" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold md:text-base">{session.tenant.name}</p>
              <p className="truncate text-xs text-muted-foreground">{scope}</p>
            </div>
            <NotificationBell initial={notifications} />
            <UserMenu portal={portal} />
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none md:px-6 md:pt-6 md:pb-10 xl:px-8"
        >
          {children}
        </main>
      </div>
      <BottomNav portal={portal} />
    </TenantProvider>
  );
}

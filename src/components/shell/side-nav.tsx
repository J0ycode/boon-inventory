"use client";

import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isActive, NAV, type NavItem, type Portal } from "./nav-config";
import { useAppPathname, useSession, useTenantHref } from "./tenant-context";

/**
 * Tablet (md → xl): collapsed 80px icon rail with 48px targets and tooltips.
 * Desktop (xl+): 256px sidebar with labels. Hidden on phones (bottom nav instead).
 */
export function SideNav({ portal }: { portal: Portal }) {
  const pathname = useAppPathname();
  const href = useTenantHref();
  const session = useSession();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col border-r border-sidebar-border bg-sidebar pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] md:flex xl:w-64">
      <Link
        href={href(NAV[portal][0].href)}
        className="flex h-16 items-center justify-center px-4 xl:justify-start"
        aria-label={`${session.tenant.name} home`}
      >
        <Logo className="xl:hidden" compact />
        <Logo className="hidden xl:inline-flex" />
      </Link>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-1">
          {NAV[portal].map((item) => (
            <li key={item.href}>
              <NavLink item={item} href={href(item.href)} active={isActive(item, pathname)} />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function NavLink({ item, href, active }: { item: NavItem; href: string; active: boolean }) {
  const Icon = item.icon;
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 items-center justify-center gap-3 rounded-lg px-3 text-sm font-semibold text-sidebar-foreground transition-colors xl:min-h-10 xl:justify-start",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="sr-only xl:not-sr-only xl:truncate">{item.label}</span>
    </Link>
  );
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block xl:hidden">{link}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
      <span className="hidden xl:block">{link}</span>
    </>
  );
}

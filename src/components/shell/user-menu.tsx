"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Building2, LogOut, Monitor, Moon, Sun, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/features/auth/actions";
import { ROLE_LABELS } from "@/lib/roles";
import { useSession, useTenantHref } from "./tenant-context";
import type { Portal } from "./nav-config";

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function UserMenu({ portal }: { portal: Portal }) {
  const session = useSession();
  const href = useTenantHref();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Account menu for ${session.full_name}`}
          className="rounded-full"
        >
          <span className="grid size-9 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
            {initials(session.full_name)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-semibold">{session.full_name}</span>
          <span className="block truncate text-xs text-muted-foreground">{session.email}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {ROLE_LABELS[session.role]} · {session.tenant.name}
          </span>
        </DropdownMenuLabel>
        {session.role === "OWNER" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {portal === "owner" ? (
                <DropdownMenuItem asChild>
                  <Link href={href("/storeroom")}>
                    <Warehouse /> Store Room view
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <Link href={href("/owner")}>
                    <Building2 /> Owner view
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="system">
            <Monitor /> System
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

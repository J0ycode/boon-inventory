import Link from "next/link";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SecondaryAction = { href: string; label: string; icon: React.ReactNode };

/**
 * Page header actions: the primary action is always visible; secondary links are buttons from md up and collapse
 * into a "More actions" menu on phones so the header stays one row.
 */
export function PageActions({ primary, secondary }: { primary?: React.ReactNode; secondary: SecondaryAction[] }) {
  return (
    <>
      {secondary.map((a) => (
        <Button key={a.href} variant="outline" asChild className="hidden md:inline-flex">
          <Link href={a.href}>
            {a.icon} {a.label}
          </Link>
        </Button>
      ))}
      {secondary.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden" aria-label="More actions">
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {secondary.map((a) => (
              <DropdownMenuItem key={a.href} asChild className="min-h-11">
                <Link href={a.href}>
                  {a.icon} {a.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {primary}
    </>
  );
}

import { notFound } from "next/navigation";
import { brandIcon } from "@/lib/brand-icon";

const ICONS = {
  "192.png": { size: 192, maskable: false },
  "512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
} as const;

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

/** PNG icons referenced by the web app manifest. */
export async function GET(_req: Request, { params }: RouteContext<"/pwa-icons/[file]">) {
  const { file } = await params;
  const icon = ICONS[file as keyof typeof ICONS];
  if (!icon) notFound();
  return brandIcon(icon.size, { maskable: icon.maskable });
}

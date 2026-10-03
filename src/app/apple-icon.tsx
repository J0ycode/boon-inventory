import { brandIcon } from "@/lib/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon (iOS rounds the corners itself, so the square is left full). */
export default function AppleIcon() {
  return brandIcon(180, { rounded: false });
}

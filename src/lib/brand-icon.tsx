import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

/**
 * App icon generated from the text logo. `maskable` keeps the mark inside the 80% safe zone and fills the whole
 * square, since Android crops maskable icons into circles or squircles.
 */
export function brandIcon(size: number, { maskable = false, rounded = true } = {}) {
  const radius = maskable || !rounded ? 0 : Math.round(size * 0.22);
  const fontSize = Math.round(size * (maskable ? 0.34 : 0.46));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: brand.colors.primary,
        color: brand.colors.primaryForeground,
        borderRadius: radius,
        fontSize,
        fontWeight: 800,
        letterSpacing: -Math.round(size / 64),
      }}
    >
      {brand.logo.mark}
    </div>,
    { width: size, height: size },
  );
}

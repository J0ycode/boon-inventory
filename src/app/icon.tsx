import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Favicon generated from the text logo in src/config/brand.ts. */
export default function Icon() {
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
        borderRadius: 14,
        fontSize: 30,
        fontWeight: 800,
        letterSpacing: -1,
      }}
    >
      {brand.logo.mark}
    </div>,
    size,
  );
}

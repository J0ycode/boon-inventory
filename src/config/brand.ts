/**
 * Single source of truth for the product's name and logo.
 * Used by page titles, the PWA manifest, app icons, PDFs, and (via `pnpm brand:emails`) auth email templates.
 */
export const brand = {
  name: "BoonBaby Store Manager",
  shortName: "BoonBaby",
  description: "Stock management for baby clothing and accessory shops.",
  /** Text-based logo placeholder until a real logo is supplied. */
  logo: {
    mark: "BB",
    wordmark: "BoonBaby",
    tagline: "Store Manager",
  },
  /** Soft teal accent; must match --primary in globals.css. Used where CSS variables are unavailable (icons, PDFs, emails). */
  colors: {
    primary: "#2a8c86",
    primaryForeground: "#ffffff",
    background: "#ffffff",
  },
} as const;

export type Brand = typeof brand;

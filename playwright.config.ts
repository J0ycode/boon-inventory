import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? `localhost:${PORT}`;

/**
 * E2E runs against the seeded demo tenant at boonbaby.{ROOT_DOMAIN}. Chromium resolves *.localhost to
 * loopback, so subdomain tenancy works without editing the hosts file.
 *
 * Three device projects cover phone, tablet, and desktop; tests/e2e/overflow.spec.ts additionally sweeps
 * all five required viewport sizes.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Generous: the dev server compiles each route on first visit.
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://boonbaby.${ROOT_DOMAIN}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 }, browserName: "chromium" },
    },
    {
      name: "tablet",
      use: {
        browserName: "chromium",
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

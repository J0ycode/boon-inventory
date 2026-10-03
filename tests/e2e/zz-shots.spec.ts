import { test } from "@playwright/test";
import { login } from "./helpers";

// Review screenshots (not part of CI). Run: SHOTS=1 pnpm exec playwright test zz-shots --project=desktop
const OUT = process.env.SHOTS_DIR ?? "test-results/shots";
const sizes = [360, 768, 1280] as const;
const heights: Record<number, number> = { 360: 800, 768: 1024, 1280: 800 };

test.skip(!process.env.SHOTS, "set SHOTS=1 to capture review screenshots");

const pages: Record<string, { user: "owner" | "storeroom" | "storeA"; paths: string[] }> = {
  storeroom: { user: "storeroom", paths: (process.env.SHOT_PATHS ?? "/storeroom/products").split(",") },
};

test("screenshots", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop");
  const user = (process.env.SHOT_USER as "owner" | "storeroom" | "storeA") ?? pages.storeroom.user;
  await login(page, user);
  for (const path of pages.storeroom.paths) {
    for (const w of sizes) {
      await page.setViewportSize({ width: w, height: heights[w]! });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${OUT}/${path.replaceAll("/", "_")}-${w}.png`, fullPage: true });
    }
  }
});

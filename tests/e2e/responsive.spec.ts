import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, login, type DemoUser } from "./helpers";

/** The five sizes the brief requires. This sweep runs once (in the desktop project) and resizes itself. */
const VIEWPORTS = [
  { name: "phone 360x800", width: 360, height: 800, nav: "bottom" },
  { name: "tablet 768x1024", width: 768, height: 1024, nav: "rail" },
  { name: "tablet 1024x768", width: 1024, height: 768, nav: "rail" },
  { name: "desktop 1280x800", width: 1280, height: 800, nav: "sidebar" },
  { name: "desktop 1920x1080", width: 1920, height: 1080, nav: "sidebar" },
] as const;

const ROUTES: Record<"owner" | "storeroom" | "storeA", string[]> = {
  owner: ["/owner", "/owner/reports", "/owner/team", "/owner/settings"],
  storeroom: [
    "/storeroom",
    "/storeroom/products",
    "/storeroom/products/new",
    "/storeroom/products/import",
    "/storeroom/suppliers",
    "/storeroom/receive",
    "/storeroom/dispatch",
    "/storeroom/requests",
    "/storeroom/returns",
    "/storeroom/labels",
    "/storeroom/reports",
  ],
  storeA: ["/store", "/store/stock", "/store/incoming", "/store/requests", "/store/returns", "/store/history"],
};

test.describe("responsive layout", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "viewport sweep runs once, in the desktop project");
  });

  test("public pages never scroll sideways", async ({ page }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      for (const path of ["/login", "/reset-password"]) {
        await page.goto(path);
        await expectNoHorizontalOverflow(page);
      }
    }
  });

  for (const user of Object.keys(ROUTES) as (keyof typeof ROUTES)[]) {
    test(`${user}: every screen fits and uses the right navigation at all sizes`, async ({ page }) => {
      test.setTimeout(240_000); // every route × five viewport sizes
      await login(page, user as DemoUser);
      for (const vp of VIEWPORTS) {
        await page.setViewportSize(vp);
        for (const path of ROUTES[user]) {
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expectNoHorizontalOverflow(page);
        }

        const sidebar = page.locator("aside");
        const bottom = page.locator("nav[aria-label='Main navigation']").last();
        if (vp.nav === "bottom") {
          await expect(sidebar).toBeHidden();
          await expect(bottom).toBeVisible();
          await expect(page.getByRole("button", { name: "Scan a barcode" })).toBeVisible();
        } else {
          await expect(sidebar).toBeVisible();
          const width = (await sidebar.boundingBox())!.width;
          expect(width, `${vp.name} sidebar width`).toBe(vp.nav === "rail" ? 80 : 256);
        }
      }
    });
  }

  test("touch targets in the phone navigation are at least 44px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await login(page, "storeA");
    const bottomNav = page.locator("nav[aria-label='Main navigation']").last();
    const targets = bottomNav.locator("a, button");
    await expect(targets.first()).toBeVisible();
    const count = await targets.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < count; i++) {
      const box = (await targets.nth(i).boundingBox())!;
      expect(box.height, `nav target ${i} height`).toBeGreaterThanOrEqual(44);
      expect(box.width, `nav target ${i} width`).toBeGreaterThanOrEqual(44);
    }
  });
});

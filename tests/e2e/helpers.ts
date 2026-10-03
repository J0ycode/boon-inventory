import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Password123!";

export const USERS = {
  owner: { email: "owner@boonbaby.test", home: "/owner" },
  storeroom: { email: "storeroom@boonbaby.test", home: "/storeroom" },
  storeA: { email: "storea@boonbaby.test", home: "/store" },
  storeB: { email: "storeb@boonbaby.test", home: "/store" },
} as const;

export type DemoUser = keyof typeof USERS;

export async function login(page: Page, user: DemoUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(USERS[user].email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  // The URL changes before the portal finishes rendering; wait for the portal itself.
  await expect(page).toHaveURL(new RegExp(`${USERS[user].home}$`), { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Account menu/ })).toBeVisible({ timeout: 20_000 });
}

/** The form-level error message (Next.js also renders an empty role=alert route announcer). */
export const formError = (page: Page) => page.locator("form [role=alert]");

/** Fails if the page is wider than the viewport (horizontal scrolling). */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `page is ${scrollWidth}px wide in a ${innerWidth}px viewport`).toBeLessThanOrEqual(innerWidth);
}

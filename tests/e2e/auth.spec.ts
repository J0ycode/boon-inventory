import { expect, test } from "@playwright/test";
import { formError, login, USERS } from "./helpers";

test.describe("authentication and role routing", () => {
  test("signed-out visitors are sent to the shop's login page", async ({ page }) => {
    await page.goto("/storeroom/products");
    await expect(page).toHaveURL(/\/login\?next=%2Fstoreroom%2Fproducts$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("BoonBaby Kids")).toBeVisible();
    await expect(page).toHaveTitle("Sign in · BoonBaby Store Manager");
  });

  test("wrong password shows a plain-language error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USERS.owner.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formError(page)).toHaveText("Email or password is incorrect.");
  });

  test("a user from another shop cannot sign in here", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@tinytots.test");
    await page.getByLabel("Password").fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formError(page)).toHaveText("Email or password is incorrect.");
  });

  for (const user of ["owner", "storeroom", "storeA"] as const) {
    test(`${user} lands on their portal`, async ({ page }) => {
      await login(page, user);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
      await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    });
  }

  test("store staff cannot open the Store Room portal", async ({ page }) => {
    await login(page, "storeA");
    await page.goto("/storeroom/products");
    await expect(page).toHaveURL(/\/store$/);
  });

  test("store room manager cannot open the owner portal", async ({ page }) => {
    await login(page, "storeroom");
    await page.goto("/owner/settings");
    await expect(page).toHaveURL(/\/storeroom$/);
  });

  test("owner can switch to the Store Room view", async ({ page }) => {
    await login(page, "owner");
    await page.goto("/storeroom/products");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Products");
  });

  test("sign out returns to the login page", async ({ page }) => {
    await login(page, "storeA");
    // Retry until hydrated: a click that lands before hydration doesn't open the menu.
    await expect(async () => {
      await page.getByRole("button", { name: /Account menu/ }).click();
      await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/store");
    await expect(page).toHaveURL(/\/login/);
  });
});

import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("receive stock", () => {
  test("store room manager receives a delivery", async ({ page }) => {
    const invoice = `INV-${test.info().project.name}-${Date.now()}`;
    await login(page, "storeroom");
    await page.goto("/storeroom/receive");

    // Without supplier/invoice the action explains what's missing.
    await page.getByRole("button", { name: "Add products to receive" }).click();

    await page.getByRole("combobox", { name: "Supplier" }).click();
    await page.getByRole("option", { name: "Little Threads Garments" }).click();
    await page.getByLabel("Supplier invoice number").fill(invoice);

    const picker = page.getByRole("combobox", { name: "Add a product" });
    await picker.fill("romper");
    await page.getByRole("option", { name: /Organic Cotton Romper — Mint/ }).click();
    // A USB scanner types the barcode and presses Enter.
    await picker.fill("BB0000000004");
    await picker.press("Enter");
    await expect(page.getByRole("button", { name: "Remove Ribbed Bodysuit — White" })).toBeVisible();

    await page.getByRole("button", { name: "Increase" }).first().click();
    await page.getByLabel("Unit cost for Organic Cotton Romper — Mint").fill("305");

    await page.getByRole("button", { name: "Receive 3 pieces" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Receive stock" }).click();

    await expect(page.getByRole("heading", { level: 1, name: /Receipt RCV-\d{5}/ })).toBeVisible();
    await expect(page.getByText(`invoice ${invoice}`)).toBeVisible();
    await expect(page.getByText("Total 3 pieces")).toBeVisible();
  });
});

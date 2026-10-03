import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const unique = (label: string) => `${label} ${test.info().project.name} ${Date.now()}`;

test.describe("products", () => {
  test("store room manager searches and filters products", async ({ page }) => {
    await login(page, "storeroom");
    await page.goto("/storeroom/products?q=bodysuit");
    await expect(page.getByText("Ribbed Bodysuit — White").filter({ visible: true }).first()).toBeVisible();

    await page.getByRole("searchbox", { name: /Search by name/ }).fill("romper");
    await expect(page).toHaveURL(/q=romper/);
    await expect(page.getByText("Organic Cotton Romper — Mint").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Ribbed Bodysuit — White")).toHaveCount(0);

    // A barcode typed by a USB scanner (Enter) finds the exact product.
    await page.getByRole("searchbox", { name: /Search by name/ }).fill("BB0000000004");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Ribbed Bodysuit — White").filter({ visible: true }).first()).toBeVisible();
  });

  test("add a product with a generated barcode, then edit it", async ({ page }) => {
    const name = unique("E2E Romper");
    await login(page, "storeroom");
    await page.goto("/storeroom/products/new");
    await page.getByLabel("Product name").fill(name);
    await page.getByLabel("Selling price (₹)").fill("599");
    await page.getByLabel("Cost price (₹)").fill("250");
    await page.getByLabel("Reorder level (pieces)").fill("4");
    await page.getByRole("button", { name: "Add product" }).click();

    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText(/Barcode BB\d{10}/)).toBeVisible();
    await expect(page.getByText(/SKU CLO-\d{5}/)).toBeVisible();

    await page.getByLabel("Selling price (₹)").fill("649");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Product saved")).toBeVisible();
  });

  test("validation explains what to fix", async ({ page }) => {
    await login(page, "storeroom");
    await page.goto("/storeroom/products/new");
    await page.getByRole("button", { name: "Add product" }).click();
    await expect(page.getByText("Enter a product name.")).toBeVisible();
    await expect(page.getByText("Enter the selling price.")).toBeVisible();
  });

  test("import previews rows and reports errors before saving", async ({ page }) => {
    await login(page, "storeroom");
    await page.goto("/storeroom/products/import");
    const sku = `E2E-${test.info().project.name}-${Date.now()}`.toUpperCase().slice(0, 40);
    const csv = `name,category,sku,selling_price,cost_price\nImported Bib,Accessory,${sku},199,80\n,Shoes,,abc,\n`;
    await page
      .locator("input[type=file]")
      .setInputFiles({ name: "products.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.getByText("Category must be Clothing or Accessory")).toBeVisible();
    await expect(page.getByRole("button", { name: "Fix errors to import" })).toBeDisabled();

    const good = `name,category,sku,selling_price,cost_price\nImported Bib,Accessory,${sku},199,80\n`;
    await page
      .locator("input[type=file]")
      .setInputFiles({ name: "products.csv", mimeType: "text/csv", buffer: Buffer.from(good) });
    await page.getByRole("button", { name: "Import 1 rows" }).click();
    await expect(page.getByText("Imported: 1 new, 0 updated")).toBeVisible();
  });

  test("store staff see their stock but never cost prices", async ({ page }) => {
    await login(page, "storeA");
    await page.goto("/store/stock?q=bodysuit");
    await expect(page.getByRole("heading", { level: 1, name: "My Stock" })).toBeVisible();
    await expect(page.getByText("Ribbed Bodysuit — White").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Cost" })).toHaveCount(0);
    await page.getByText("Ribbed Bodysuit — White").filter({ visible: true }).first().click();
    await expect(page.getByText("History at Store A — MG Road")).toBeVisible();
  });
});

test.describe("team", () => {
  test("owner invites a staff member", async ({ page }) => {
    await login(page, "owner");
    await page.goto("/owner/team");
    await expect(page.getByText("Meera Store A")).toBeVisible();

    const email = `e2e.${test.info().project.name}.${Date.now()}@boonbaby.test`;
    await page.getByRole("button", { name: "Invite" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("E2E Staff");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByRole("combobox", { name: "Store" }).click();
    await page.getByRole("option", { name: "Store A — MG Road" }).click();
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText(`Invite sent to ${email}`)).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("barcode labels", () => {
  test("labels for a receipt on a partly used 65-up sheet", async ({ page }) => {
    await login(page, "storeroom");
    await page.goto("/storeroom/labels");

    // Add a product by scanning, and set copies.
    const picker = page.getByRole("combobox", { name: "Add a product" });
    await picker.fill("BB0000000001");
    await picker.press("Enter");
    await page.getByRole("button", { name: "Increase" }).first().click();
    await page.getByRole("button", { name: "Increase" }).first().click();

    await page.getByRole("combobox", { name: "Sticker sheet" }).click();
    await page.getByRole("option", { name: /65 per sheet/ }).click();
    await page.getByRole("radio", { name: "Start at sticker 4 (row 1, column 4)" }).click();
    await expect(page.getByRole("status").filter({ hasText: "3 labels on 1 sheet" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Preview of the first label sheet" })).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("barcode-labels.pdf");
    if (process.env.SHOTS_DIR) await file.saveAs(`${process.env.SHOTS_DIR}/labels.pdf`);
  });
});

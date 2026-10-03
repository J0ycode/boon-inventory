import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("dispatch", () => {
  test("store room sends, store reports damage, store room writes it off", async ({ browser, baseURL }) => {
    test.setTimeout(90_000);
    const viewport = test.info().project.use.viewport ?? undefined;
    const manager = await (await browser.newContext({ baseURL, viewport })).newPage();
    const staff = await (await browser.newContext({ baseURL, viewport })).newPage();

    // --- Store Room: draft and send -------------------------------------------------
    await login(manager, "storeroom");
    await manager.goto("/storeroom/dispatch/new");
    await manager.getByRole("combobox", { name: "Send to" }).click();
    await manager.getByRole("option", { name: "Store A — MG Road" }).click();
    const picker = manager.getByRole("combobox", { name: "Add a product" });
    await picker.fill("BB0000000004");
    await picker.press("Enter");
    await picker.fill("BB0000000020");
    await picker.press("Enter");
    await expect(manager.getByRole("button", { name: /^Remove / })).toHaveCount(2);
    await manager.getByRole("button", { name: "Increase" }).first().click(); // 2 + 1 = 3 pieces

    await manager.getByRole("button", { name: "Send", exact: true }).click();
    await manager.getByRole("alertdialog").getByRole("button", { name: "Send dispatch" }).click();
    const heading = manager.getByRole("heading", { level: 1, name: /Dispatch DSP-\d{5}/ });
    await expect(heading).toBeVisible();
    await expect(manager.getByText("Dispatched", { exact: true })).toBeVisible();
    const number = (await heading.textContent())!.replace("Dispatch ", "");

    // --- Store: confirm with one damaged piece ---------------------------------------
    await login(staff, "storeA");
    await staff.goto("/store/incoming");
    await staff.getByText(number).filter({ visible: true }).first().click();
    await expect(staff.getByRole("heading", { level: 1, name: `Delivery ${number}` })).toBeVisible();
    await staff.getByRole("button", { name: "Report missing or damaged" }).first().click();
    await staff.getByRole("group", { name: /^Damaged pieces of/ }).getByRole("button", { name: "Increase" }).click();
    await expect(staff.getByRole("button", { name: "Add a note for each problem" })).toBeDisabled();
    await staff.getByLabel(/What happened/).fill("Torn packaging");
    await staff.getByRole("button", { name: /Confirm \d+ received/ }).click();
    await staff.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
    await expect(staff.getByText("Delivery confirmed. Issues sent to the Store Room.")).toBeVisible();

    // --- Store Room: resolve ----------------------------------------------------------
    await manager.goto("/storeroom/returns?show=issues");
    const card = manager.getByRole("listitem").filter({ hasText: number });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Write off" }).click();
    await manager.getByRole("alertdialog").getByRole("button", { name: "Write off" }).click();
    await expect(manager.getByText("Written off")).toBeVisible();

    await manager.goto("/storeroom/dispatch?show=done");
    await expect(manager.getByText(number).filter({ visible: true }).first()).toBeVisible();
  });
});

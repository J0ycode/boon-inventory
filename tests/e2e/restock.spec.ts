import { expect, test, type Browser, type Page } from "@playwright/test";
import { login, type DemoUser } from "./helpers";

async function pageFor(browser: Browser, baseURL: string | undefined, user: DemoUser): Promise<Page> {
  const viewport = test.info().project.use.viewport ?? undefined;
  const page = await (await browser.newContext({ baseURL, viewport })).newPage();
  await login(page, user);
  return page;
}

test.describe("restock requests", () => {
  test("suggested restock: staff approve and forward, store room approves into a draft dispatch", async ({ browser, baseURL }) => {
    test.skip(test.info().project.name !== "desktop", "shares store B's suggestions; runs once");
    test.setTimeout(90_000);
    const staff = await pageFor(browser, baseURL, "storeB");
    await staff.goto("/store/requests");
    await staff.getByRole("button", { name: "Suggest restock" }).click();
    await expect(staff.getByText(/low-stock items suggested/)).toBeVisible();
    await staff.getByRole("link", { name: /suggested items are waiting for your approval/ }).click();
    const heading = staff.getByRole("heading", { level: 1, name: /^Request REQ-\d{5}$/ });
    await expect(heading).toBeVisible();
    const number = (await heading.textContent())!.replace("Request ", "");

    // Store Room can't see it yet.
    const manager = await pageFor(browser, baseURL, "storeroom");
    await manager.goto("/storeroom/requests");
    await expect(manager.getByRole("heading", { level: 1, name: "Restock Requests" })).toBeVisible();
    await expect(manager.getByText(number)).toHaveCount(0);

    await staff.getByRole("button", { name: "Skip" }).first().click();
    await staff.getByRole("button", { name: "Approve all remaining" }).click();
    await expect(staff.getByText("Every line is reviewed. Forward when ready.")).toBeVisible();
    await staff.getByRole("button", { name: "Forward to Store Room" }).click();
    await staff.getByRole("alertdialog").getByRole("button", { name: "Forward" }).click();
    await expect(staff.getByText("Forwarded to the Store Room")).toBeVisible();

    await manager.reload();
    await manager.getByText(number).filter({ visible: true }).first().click();
    await expect(manager.getByText("Suggested, approved by staff", { exact: false })).toBeVisible();
    await manager.getByRole("button", { name: "Approve & prepare dispatch" }).click();
    await manager.getByRole("alertdialog").getByRole("button", { name: "Approve" }).click();
    await expect(manager.getByRole("heading", { level: 1, name: /Dispatch DSP-\d{5}/ })).toBeVisible();
    await expect(manager.getByText("Draft", { exact: true })).toBeVisible();
  });

  test("manual request is rejected with a reason the store can read", async ({ browser, baseURL }) => {
    test.setTimeout(90_000);
    const staff = await pageFor(browser, baseURL, "storeA");
    await staff.goto("/store/requests/new");
    const picker = staff.getByRole("combobox", { name: "Add a product" });
    await picker.fill("BB0000000013");
    await picker.press("Enter");
    await expect(staff.getByRole("button", { name: /^Remove / })).toHaveCount(1);
    await staff.getByRole("button", { name: "Send to Store Room" }).click();
    await staff.getByRole("alertdialog").getByRole("button", { name: "Send request" }).click();
    const sent = staff.getByText(/REQ-\d{5} sent to the Store Room/);
    await expect(sent).toBeVisible();
    const number = (await sent.textContent())!.match(/REQ-\d{5}/)![0];

    const manager = await pageFor(browser, baseURL, "storeroom");
    await manager.goto("/storeroom/requests");
    await manager.getByText(number).filter({ visible: true }).first().click();
    await manager.getByRole("button", { name: "Reject" }).click();
    await manager.getByLabel("Reason").fill("Out of stock until next week");
    await manager.getByRole("button", { name: "Reject request" }).click();
    await expect(manager.getByText("Request rejected")).toBeVisible();

    await staff.goto("/store/requests?show=history");
    await staff.getByText(number).filter({ visible: true }).first().click();
    await expect(staff.getByText("Out of stock until next week")).toBeVisible();
  });
});

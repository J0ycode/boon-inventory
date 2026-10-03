import { expect, test, type Browser, type Page } from "@playwright/test";
import { login, type DemoUser } from "./helpers";

const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"}/functions/v1/sales`;
const STORE_A = "10000000-0000-4000-8000-000000000011";

async function pageFor(browser: Browser, baseURL: string | undefined, user: DemoUser): Promise<Page> {
  const viewport = test.info().project.use.viewport ?? undefined;
  const page = await (await browser.newContext({ baseURL, viewport })).newPage();
  await login(page, user);
  return page;
}

test.describe("returns and damage", () => {
  test("store sends a return, store room approves it", async ({ browser, baseURL }) => {
    test.setTimeout(90_000);
    const reason = `E2E return ${test.info().project.name} ${Date.now()}`;
    const staff = await pageFor(browser, baseURL, "storeA");
    await staff.goto("/store/returns");
    await staff.getByRole("radio", { name: /Return to Store Room/ }).click();
    const picker = staff.getByRole("combobox", { name: "Find the product" });
    await picker.fill("BB0000000014");
    await picker.press("Enter");
    await staff.getByLabel("Reason").fill(reason);
    await staff.getByRole("button", { name: "Send for approval" }).click();
    await staff.getByRole("alertdialog").getByRole("button", { name: "Send for approval" }).click();
    await expect(staff.getByText(/RET-\d{5} sent for approval/)).toBeVisible();

    const manager = await pageFor(browser, baseURL, "storeroom");
    await manager.goto("/storeroom/returns");
    const card = manager.getByRole("listitem").filter({ hasText: reason });
    await card.getByRole("button", { name: "Approve" }).click();
    await manager.getByRole("alertdialog").getByRole("button", { name: "Approve" }).click();
    await expect(manager.getByText(/RET-\d{5} approved/)).toBeVisible();

    await staff.reload();
    await expect(staff.getByRole("listitem").filter({ hasText: reason }).getByText("Approved")).toBeVisible();
  });
});

test.describe("sales API", () => {
  test("owner creates a key; the billing system records a sale; rotation revokes the old key", async ({ page, request }) => {
    test.skip(test.info().project.name !== "desktop", "API behaviour is device-independent; runs once");
    await login(page, "owner");
    await page.goto("/owner/settings");
    await page.getByLabel("New key name").fill("E2E billing");
    await page.getByRole("button", { name: "Create key" }).click();
    const key = (await page.getByTestId("new-api-key").textContent())!.trim();
    expect(key).toMatch(/^bb_live_[0-9a-f]{8}_/);
    await page.keyboard.press("Escape");

    const sale = { location_id: STORE_A, external_ref: `E2E-${Date.now()}`, items: [{ barcode: "BB0000000003", quantity: 1 }] };
    const first = await request.post(FUNCTIONS_URL, { headers: { Authorization: `Bearer ${key}` }, data: sale });
    expect(first.status()).toBe(201);
    const body = await first.json();
    expect(body.duplicate).toBe(false);
    expect(body.lines[0]).toMatchObject({ barcode: "BB0000000003", quantity: 1 });

    const retry = await request.post(FUNCTIONS_URL, { headers: { Authorization: `Bearer ${key}` }, data: sale });
    expect(retry.status()).toBe(200);
    expect((await retry.json()).sale_id).toBe(body.sale_id);

    const unknown = await request.post(FUNCTIONS_URL, {
      headers: { Authorization: `Bearer ${key}` },
      data: { ...sale, external_ref: `${sale.external_ref}-x`, items: [{ barcode: "NOPE", quantity: 1 }] },
    });
    expect(unknown.status()).toBe(422);
    expect((await unknown.json()).error.code).toBe("UNKNOWN_BARCODE");

    await page.getByRole("listitem").filter({ hasText: "E2E billing" }).getByRole("button", { name: "Rotate" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Rotate key" }).click();
    await expect(page.getByTestId("new-api-key")).toBeVisible();
    const old = await request.post(FUNCTIONS_URL, {
      headers: { Authorization: `Bearer ${key}` },
      data: { ...sale, external_ref: `${sale.external_ref}-old` },
    });
    expect(old.status()).toBe(401);
  });
});

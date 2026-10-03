import { describe, expect, it } from "vitest";
import { extractApiKey, mapDbError, parseSaleRequest } from "./logic";

const valid = {
  location_id: "10000000-0000-4000-8000-000000000011",
  external_ref: " BILL-1 ",
  items: [{ barcode: " BB0000000004 ", quantity: 2 }],
};

describe("sales API request parsing", () => {
  it("accepts a valid sale and trims values", () => {
    expect(parseSaleRequest(valid)).toEqual({
      ok: true,
      value: { location_id: valid.location_id, external_ref: "BILL-1", items: [{ barcode: "BB0000000004", quantity: 2 }] },
    });
  });

  it.each([
    [null, "Body must be a JSON object."],
    [{ ...valid, location_id: "store-a" }, "location_id must be a store UUID."],
    [{ ...valid, external_ref: "" }, "external_ref is required (1–120 characters)."],
    [{ ...valid, items: [] }, "items must be a non-empty array."],
    [{ ...valid, items: [{ barcode: "X", quantity: 1.5 }] }, "items[0].quantity must be a whole number from 1 to 100000."],
    [{ ...valid, items: [{ quantity: 1 }] }, "items[0].barcode is required."],
  ])("rejects %j", (body, message) => {
    const result = parseSaleRequest(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toEqual({ status: 400, code: "INVALID_REQUEST", message });
  });
});

describe("API key extraction", () => {
  it("reads Bearer and X-API-Key headers", () => {
    expect(extractApiKey(new Headers({ authorization: "Bearer bb_live_abc_def" }))).toBe("bb_live_abc_def");
    expect(extractApiKey(new Headers({ "x-api-key": "bb_live_x_y" }))).toBe("bb_live_x_y");
    expect(extractApiKey(new Headers())).toBeNull();
  });
});

describe("error mapping", () => {
  it.each([
    ["BB_INVALID_API_KEY", 401, "INVALID_API_KEY"],
    ["BB_TENANT_PAST_DUE", 403, "ACCOUNT_READ_ONLY"],
    ["BB_LOCATION_NOT_FOUND", 404, "LOCATION_NOT_FOUND"],
    ["BB_INSUFFICIENT_STOCK", 409, "INSUFFICIENT_STOCK"],
    ["BB_UNKNOWN_BARCODE", 422, "UNKNOWN_BARCODE"],
    [undefined, 500, "INTERNAL_ERROR"],
  ])("%s → %i %s", (hint, status, code) => {
    expect(mapDbError(hint, "msg")).toMatchObject({ status, code });
  });

  it("never leaks raw database messages for unexpected errors", () => {
    expect(mapDbError(null, "relation does not exist").message).not.toContain("relation");
  });
});

import { describe, expect, it } from "vitest";
import { errorCode, toUserMessage } from "./errors";

describe("toUserMessage", () => {
  it("shows the human-written message from our database functions", () => {
    const err = {
      code: "P0001",
      hint: "BB_INSUFFICIENT_STOCK",
      message: 'Not enough stock of "Romper". Available: 2, needed: 5.',
    };
    expect(errorCode(err)).toBe("BB_INSUFFICIENT_STOCK");
    expect(toUserMessage(err)).toBe('Not enough stock of "Romper". Available: 2, needed: 5.');
  });

  it("explains unique-constraint violations", () => {
    expect(
      toUserMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "products_tenant_id_barcode_key"',
      }),
    ).toBe("Another product already uses this barcode.");
  });

  it("explains the negative-stock backstop", () => {
    expect(toUserMessage({ code: "23514", message: 'violates check constraint "stock_levels_quantity_check"' })).toBe(
      "Stock can't go below zero.",
    );
  });

  it("explains permission and network failures", () => {
    expect(toUserMessage({ code: "42501", message: "permission denied for table stock_levels" })).toBe(
      "You do not have permission to do this.",
    );
    expect(toUserMessage({ message: "TypeError: Failed to fetch" })).toBe(
      "Can't reach the server. Check your connection and try again.",
    );
  });

  it("never leaks raw database text for unknown errors", () => {
    expect(toUserMessage({ code: "XX000", message: "internal error at relation 1234" })).toBe(
      "Something went wrong. Please try again.",
    );
    expect(toUserMessage(null)).toBe("Something went wrong. Please try again.");
  });
});

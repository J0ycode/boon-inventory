import { describe, expect, it } from "vitest";
import { perSheet, placeLabels, PRESETS, SHEET, sheetCount } from "./layout";

describe("label presets", () => {
  it.each([24, 40, 65] as const)("%i-up fits on A4", (id) => {
    const p = PRESETS[id];
    expect(perSheet(p)).toBe(id);
    expect(p.left + (p.cols - 1) * p.pitchX + p.width).toBeLessThanOrEqual(SHEET.width + 0.01);
    expect(p.top + (p.rows - 1) * p.pitchY + p.height).toBeLessThanOrEqual(SHEET.height + 0.01);
  });
});

describe("placeLabels", () => {
  it("places copies in reading order", () => {
    const placed = placeLabels(PRESETS[24], [
      { productId: "a", copies: 2 },
      { productId: "b", copies: 2 },
    ]);
    expect(placed.map((l) => [l.productId, l.index])).toEqual([
      ["a", 0],
      ["a", 1],
      ["b", 2],
      ["b", 3],
    ]);
    expect(placed[3]).toMatchObject({ x: PRESETS[24].left, y: PRESETS[24].top + PRESETS[24].pitchY });
  });

  it("starts at the chosen position on a partly used sheet", () => {
    const placed = placeLabels(PRESETS[65], [{ productId: "a", copies: 3 }], 62);
    expect(placed.map((l) => [l.page, l.index])).toEqual([
      [0, 62],
      [0, 63],
      [0, 64],
    ]);
  });

  it("continues on new sheets from the top", () => {
    const placed = placeLabels(PRESETS[40], [{ productId: "a", copies: 5 }], 38);
    expect(placed.map((l) => [l.page, l.index])).toEqual([
      [0, 38],
      [0, 39],
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
    expect(sheetCount(placed)).toBe(2);
  });

  it("ignores zero or negative copies and clamps the start", () => {
    expect(placeLabels(PRESETS[24], [{ productId: "a", copies: 0 }])).toEqual([]);
    expect(placeLabels(PRESETS[24], [{ productId: "a", copies: 1 }], 999)[0]!.index).toBe(23);
  });
});

/**
 * A4 sticker sheet presets (millimetres) and the maths that places labels on sheets.
 * Dimensions match common A4 label stock: 24-up (63.5 × 33.9), 40-up (52.5 × 29.7), 65-up (38.1 × 21.2).
 */

export type PresetId = 24 | 40 | 65;

export type Preset = {
  id: PresetId;
  name: string;
  cols: number;
  rows: number;
  /** Label size. */
  width: number;
  height: number;
  /** Offset of the first label from the sheet's top-left corner. */
  left: number;
  top: number;
  /** Distance between the left edges / top edges of neighbouring labels. */
  pitchX: number;
  pitchY: number;
};

export const SHEET = { width: 210, height: 297 } as const;

export const PRESETS: Record<PresetId, Preset> = {
  24: { id: 24, name: "24 per sheet (63.5 × 33.9 mm)", cols: 3, rows: 8, width: 63.5, height: 33.9, left: 7.2, top: 12.9, pitchX: 66, pitchY: 33.9 },
  40: { id: 40, name: "40 per sheet (52.5 × 29.7 mm)", cols: 4, rows: 10, width: 52.5, height: 29.7, left: 0, top: 0, pitchX: 52.5, pitchY: 29.7 },
  65: { id: 65, name: "65 per sheet (38.1 × 21.2 mm)", cols: 5, rows: 13, width: 38.1, height: 21.2, left: 4.65, top: 10.7, pitchX: 40.6, pitchY: 21.2 },
};

export const perSheet = (p: Preset) => p.cols * p.rows;

export type LabelItem = { productId: string; copies: number };

export type PlacedLabel = { productId: string; page: number; index: number; x: number; y: number };

/**
 * Places `copies` labels per item in order, starting at `startIndex` (0-based, row by row) on the first sheet so a
 * partly used sheet can be reused. Following sheets start at position 0.
 */
export function placeLabels(preset: Preset, items: LabelItem[], startIndex = 0): PlacedLabel[] {
  const slots = perSheet(preset);
  const start = Math.min(Math.max(0, Math.floor(startIndex)), slots - 1);
  const placed: PlacedLabel[] = [];
  let cursor = start;
  for (const item of items) {
    for (let c = 0; c < Math.max(0, Math.floor(item.copies)); c++) {
      const page = Math.floor(cursor / slots);
      const index = cursor % slots;
      const col = index % preset.cols;
      const row = Math.floor(index / preset.cols);
      placed.push({
        productId: item.productId,
        page,
        index,
        x: preset.left + col * preset.pitchX,
        y: preset.top + row * preset.pitchY,
      });
      cursor++;
    }
  }
  return placed;
}

export const sheetCount = (placed: PlacedLabel[]) => (placed.length ? placed[placed.length - 1]!.page + 1 : 0);

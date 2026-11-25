import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Nudge, PageSizeName, RawSheet, Rect, Sheet } from "./types";

/** CSS pixels (96 per inch) per millimetre: the unit Hyper Elements lays out in. */
export const PX_PER_MM = 96 / 25.4;

export const PAGE_SIZES_MM: Record<PageSizeName, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
};

export const mmToPx = (mm: number): number => mm * PX_PER_MM;

/**
 * Hyper Elements snaps box widths to whole pixels (heights and offsets stay exact). A label 374.54 px
 * wide would be drawn 375 px wide and push the next column 0.46 px out. So each slot is given the
 * whole-pixel width just inside the die cut (never wider than the label) and the remainder goes into
 * the gap, which keeps every column on its published pitch.
 */
export function snapColumns(sheet: { labelWidth: number; pitchX: number }): { widthPx: number; gapPx: number } {
  const widthPx = Math.floor(mmToPx(sheet.labelWidth) + 1e-6);
  return { widthPx, gapPx: mmToPx(sheet.pitchX) - widthPx };
}

const round = (n: number): number => Math.round(n * 1e6) / 1e6;

export function normaliseSheet(raw: RawSheet): Sheet {
  const k = raw.unit === "in" ? 25.4 : 1;
  const page = PAGE_SIZES_MM[raw.page];
  return {
    id: raw.id,
    brand: raw.brand,
    description: raw.description,
    page: raw.page,
    pageWidth: page.width,
    pageHeight: page.height,
    labelWidth: round(raw.label.width * k),
    labelHeight: round(raw.label.height * k),
    columns: raw.grid.columns,
    rows: raw.grid.rows,
    marginTop: round(raw.margin.top * k),
    marginLeft: round(raw.margin.left * k),
    pitchX: round(raw.pitch.x * k),
    pitchY: round(raw.pitch.y * k),
    cornerRadius: round(raw.cornerRadius * k),
    perSheet: raw.grid.columns * raw.grid.rows,
  };
}

export function loadRawSheets(path?: string): RawSheet[] {
  const file = path ?? fileURLToPath(new URL("../data/sheets.json", import.meta.url));
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { sheets: RawSheet[] };
  return parsed.sheets;
}

export function loadSheets(path?: string): Sheet[] {
  return loadRawSheets(path).map(normaliseSheet);
}

export function findSheet(sheets: Sheet[], id: string): Sheet {
  const hit = sheets.find((s) => s.id.toLowerCase() === id.toLowerCase());
  if (!hit) {
    throw new Error(`Unknown sheet "${id}". Known sheets: ${sheets.map((s) => s.id).join(", ")}.`);
  }
  return hit;
}

export interface Slot {
  col: number; // 0-based
  row: number; // 0-based
}

/** Row-major slot number (0-based) to column/row. */
export function slotToCell(sheet: Sheet, slot: number): Slot {
  if (slot < 0 || slot >= sheet.perSheet) throw new RangeError(`Slot ${slot} is outside 0..${sheet.perSheet - 1}.`);
  return { col: slot % sheet.columns, row: Math.floor(slot / sheet.columns) };
}

/** Rectangle of a label in mm from the page's top-left corner, with the printer nudge applied. */
export function labelRect(sheet: Sheet, col: number, row: number, nudge: Nudge = { x: 0, y: 0 }): Rect {
  return {
    x: round(sheet.marginLeft + col * sheet.pitchX + nudge.x),
    y: round(sheet.marginTop + row * sheet.pitchY + nudge.y),
    width: sheet.labelWidth,
    height: sheet.labelHeight,
  };
}

/** Every label rectangle on one page, row-major. */
export function allRects(sheet: Sheet, nudge: Nudge = { x: 0, y: 0 }): Rect[] {
  const rects: Rect[] = [];
  for (let row = 0; row < sheet.rows; row++) {
    for (let col = 0; col < sheet.columns; col++) rects.push(labelRect(sheet, col, row, nudge));
  }
  return rects;
}

/** Throws if the (nudged) grid would leave the page, since flow layout cannot place a label off-page. */
export function assertOnPage(sheet: Sheet, nudge: Nudge): void {
  const first = labelRect(sheet, 0, 0, nudge);
  const last = labelRect(sheet, sheet.columns - 1, sheet.rows - 1, nudge);
  const eps = 1e-6;
  if (
    first.x < -eps ||
    first.y < -eps ||
    last.x + last.width > sheet.pageWidth + eps ||
    last.y + last.height > sheet.pageHeight + eps
  ) {
    throw new Error(
      `Nudge (${nudge.x}, ${nudge.y}) mm pushes ${sheet.id} labels off the ${sheet.page} page. ` +
        `Room: x ${(-first.x + nudge.x).toFixed(2)}..${(sheet.pageWidth - last.x - last.width + nudge.x).toFixed(2)} mm, ` +
        `y ${(-first.y + nudge.y).toFixed(2)}..${(sheet.pageHeight - last.y - last.height + nudge.y).toFixed(2)} mm.`
    );
  }
}

export interface Page {
  /** For each slot on the page: index into the label list, or null when the slot is left empty. */
  slots: Array<number | null>;
  labelCount: number;
}

export interface Pagination {
  pages: Page[];
  perSheet: number;
  /** Slots left empty before the first label (start - 1). */
  skipped: number;
  /** Empty slots after the last label, on the last page. */
  blanksOnLast: number;
  /** 1-based slot to give `--start` next time to carry on from where this run stopped. */
  nextStart: number;
}

/** Lay `count` labels onto sheets of `perSheet` slots, beginning at 1-based slot `start`. */
export function paginate(count: number, start: number, perSheet: number): Pagination {
  if (!Number.isInteger(start) || start < 1 || start > perSheet) {
    throw new RangeError(`--start must be a whole number from 1 to ${perSheet}.`);
  }
  if (!Number.isInteger(count) || count < 0) throw new RangeError("Label count must be a whole number >= 0.");
  const skipped = start - 1;
  const pageCount = Math.ceil((skipped + count) / perSheet);
  const pages: Page[] = [];
  for (let p = 0; p < pageCount; p++) {
    const slots: Array<number | null> = [];
    let labelCount = 0;
    for (let s = 0; s < perSheet; s++) {
      const index = p * perSheet + s - skipped;
      if (index >= 0 && index < count) {
        slots.push(index);
        labelCount++;
      } else {
        slots.push(null);
      }
    }
    pages.push({ slots, labelCount });
  }
  const used = (skipped + count) % perSheet;
  const blanksOnLast = pageCount === 0 ? 0 : used === 0 ? 0 : perSheet - used;
  // After a run that filled its last sheet exactly, the next label goes on a fresh sheet (slot 1).
  const nextStart = used === 0 ? 1 : used + 1;
  return { pages, perSheet, skipped, blanksOnLast, nextStart };
}

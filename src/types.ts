export type PageSizeName = "A4" | "Letter";

/** A sheet as written in data/sheets.json (published units, verbatim). */
export interface RawSheet {
  id: string;
  brand: string;
  description: string;
  unit: "mm" | "in";
  page: PageSizeName;
  label: { width: number; height: number };
  grid: { columns: number; rows: number };
  margin: { top: number; left: number };
  pitch: { x: number; y: number };
  cornerRadius: number;
}

/** A sheet normalised to millimetres. */
export interface Sheet {
  id: string;
  brand: string;
  description: string;
  page: PageSizeName;
  pageWidth: number;
  pageHeight: number;
  labelWidth: number;
  labelHeight: number;
  columns: number;
  rows: number;
  marginTop: number;
  marginLeft: number;
  pitchX: number;
  pitchY: number;
  cornerRadius: number;
  perSheet: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Nudge {
  x: number;
  y: number;
}

/** One CSV row, parsed and validated. */
export interface Product {
  name: string;
  variety: string;
  batchDate: string; // ISO yyyy-mm-dd
  shelfLifeMonths: number;
  quantity: number;
  allergens: string[];
  accent: string;
  code: string;
}

/** A product plus the fields Gumline derives. */
export interface Jar extends Product {
  bestBefore: string; // ISO
  batchCode: string; // e.g. JAM-2611-03
}

export interface RunOptions {
  start: number;
  nudge: Nudge;
  tint: boolean;
}

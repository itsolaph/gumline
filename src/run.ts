import { copyFile, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { createElement, type ReactElement } from "react";
import type { CliOptions } from "./cli";
import { ACCENT_KEYS, expandLabels, latestBatchDate, loadJars } from "./data";
import { woff2Path } from "./fonts";
import { assertOnPage, findSheet, loadSheets, paginate, type Pagination } from "./geometry";
import { buildInventory } from "./inventory";
import { AlignDocument } from "./templates/AlignDocument";
import { LabelCanvas } from "./templates/LabelCanvas";
import { PantryPage, type WebFont } from "./templates/PantryPage";
import { PrintRunEmail, type RunSummary } from "./templates/PrintRunEmail";
import { SheetDocument } from "./templates/SheetDocument";
import type { Jar, Sheet } from "./types";

export interface SheetRun {
  sheet: Sheet;
  pagination: Pagination;
  summary: RunSummary;
}

export interface RunContext {
  options: CliOptions;
  jars: Jar[];
  labels: Jar[];
  sheets: Sheet[];
  pngSheet: Sheet;
  referenceDate: string;
  runs: SheetRun[];
}

export function createContext(options: CliOptions): RunContext {
  const registry = loadSheets();
  const sheets = options.sheets.length ? options.sheets.map((id) => findSheet(registry, id)) : registry;
  const jars = loadJars(options.csv);
  const labels = expandLabels(jars);
  const pngSheet = findSheet(registry, options.pngSheet ?? (registry.some((s) => s.id === "L7163") ? "L7163" : registry[0].id));
  const referenceDate = options.referenceDate ?? latestBatchDate(jars);

  const runs = sheets.map((sheet): SheetRun => {
    assertOnPage(sheet, options.nudge);
    const pagination = paginate(labels.length, options.start, sheet.perSheet);
    return {
      sheet,
      pagination,
      summary: {
        sheetId: sheet.id,
        brand: sheet.brand,
        pageSize: sheet.page,
        pdf: `${sheet.id}.pdf`,
        alignPdf: `${sheet.id}-align.pdf`,
        perSheet: sheet.perSheet,
        start: options.start,
        labels: labels.length,
        pages: pagination.pages.length,
        blanksOnLast: pagination.blanksOnLast,
        nextStart: pagination.nextStart,
      },
    };
  });
  return { options, jars, labels, sheets, pngSheet, referenceDate, runs };
}

export const WEB_FONT_FILES = [
  { family: "Fraunces", pkg: "fraunces", file: "fraunces-latin-700-normal.woff2", weight: 700, style: "normal" },
  { family: "Fraunces", pkg: "fraunces", file: "fraunces-latin-400-italic.woff2", weight: 400, style: "italic" },
  { family: "DM Sans", pkg: "dm-sans", file: "dm-sans-latin-400-normal.woff2", weight: 400, style: "normal" },
  { family: "DM Sans", pkg: "dm-sans", file: "dm-sans-latin-500-normal.woff2", weight: 500, style: "normal" },
  { family: "DM Sans", pkg: "dm-sans", file: "dm-sans-latin-700-normal.woff2", weight: 700, style: "normal" },
  { family: "IBM Plex Mono", pkg: "ibm-plex-mono", file: "ibm-plex-mono-latin-500-normal.woff2", weight: 500, style: "normal" },
  { family: "IBM Plex Mono", pkg: "ibm-plex-mono", file: "ibm-plex-mono-latin-600-normal.woff2", weight: 600, style: "normal" },
] as const;

export function webFonts(prefix = "./fonts/"): WebFont[] {
  return WEB_FONT_FILES.map((f) => ({ family: f.family, src: `${prefix}${f.file}`, format: "woff2", weight: f.weight, style: f.style }));
}

/** Copies the woff2 files next to pantry.html so the page works offline and without any CDN. */
export async function copyWebFonts(outDir: string): Promise<void> {
  const dir = join(outDir, "fonts");
  await mkdir(dir, { recursive: true });
  for (const f of WEB_FONT_FILES) {
    const src = woff2Path(f.pkg, f.file);
    await copyFile(src, join(dir, basename(src)));
  }
}

export const sheetElement = (ctx: RunContext, run: SheetRun): ReactElement =>
  createElement(SheetDocument, {
    sheet: run.sheet,
    labels: ctx.labels,
    pagination: run.pagination,
    nudge: ctx.options.nudge,
    tint: ctx.options.tint,
  });

export const alignElement = (ctx: RunContext, run: SheetRun): ReactElement =>
  createElement(AlignDocument, { sheet: run.sheet, nudge: ctx.options.nudge });

export const labelElement = (ctx: RunContext, jar: Jar): ReactElement => createElement(LabelCanvas, { jar, sheet: ctx.pngSheet });

export const pantryElement = (ctx: RunContext): ReactElement =>
  createElement(PantryPage, {
    rows: buildInventory(ctx.jars, ctx.referenceDate),
    referenceDate: ctx.referenceDate,
    fonts: webFonts(),
    labelsHref: ctx.runs.map((r) => r.summary.pdf),
  });

export const emailElement = (ctx: RunContext): ReactElement =>
  createElement(PrintRunEmail, {
    runs: ctx.runs.map((r) => r.summary),
    products: ctx.jars.length,
    labels: ctx.labels.length,
    nudge: ctx.options.nudge,
    accentKeys: [...new Set(ctx.jars.map((j) => j.accent))].filter((k) => (ACCENT_KEYS as readonly string[]).includes(k)),
  });

export function labelFileName(jar: Jar): string {
  return `${jar.batchCode.toLowerCase()}-${jar.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
}

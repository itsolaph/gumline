/**
 * Measures the rendered PDFs, not the code: for every sheet it renders the print PDF (with the paper
 * tint on, so each label paints a rectangle) and the alignment PDF, reads the drawing operators back
 * and compares the first and last label corner with data/sheets.json.
 *   npm run verify -- [--sheet L7160] [--start 8] [--nudge-x 0.5] ...
 * Exits non-zero if any corner is more than 0.05 mm out.
 */
import { renderPdf } from "@hyper-elements/react/pdf";
import { parseArgs } from "../src/cli";
import { loadFonts } from "../src/fonts";
import { labelRect, slotToCell } from "../src/geometry";
import { colorMatches, countPages, measurePdf } from "../src/pdfmeasure";
import { alignElement, createContext, sheetElement } from "../src/run";
import { PALETTE } from "../src/theme";

const TOL = 0.05;
const MAX_NARROWER = 25.4 / 96 + TOL; // one CSS pixel
const options = parseArgs(process.argv.slice(2));
options.tint = true;
const ctx = createContext(options);
const fonts = loadFonts();
let failed = false;

const f = (n: number): string => n.toFixed(3).padStart(8);

for (const run of ctx.runs) {
  const { sheet, pagination } = run;
  const { pdf } = await renderPdf(sheetElement(ctx, run), { fonts });
  const pages = measurePdf(pdf);
  const labelRects = pages.map((p) => p.rects.filter((r) => colorMatches(r.color, PALETTE.paper) && r.width < sheet.pageWidth / 2));

  const firstPage = pagination.pages[0];
  const firstSlot = firstPage.slots.findIndex((s) => s !== null);
  const lastPage = pagination.pages[pagination.pages.length - 1];
  const lastSlot = lastPage.slots.length - 1 - [...lastPage.slots].reverse().findIndex((s) => s !== null);

  const cases = [
    { what: "first label", got: labelRects[0][0], slot: firstSlot },
    { what: "last label", got: labelRects[labelRects.length - 1].at(-1)!, slot: lastSlot },
  ];
  console.log(`\n${sheet.id} (${sheet.page}): ${countPages(pdf)} pages, expected ${pagination.pages.length}`);
  if (countPages(pdf) !== pagination.pages.length) failed = true;
  for (const c of cases) {
    const { col, row } = slotToCell(sheet, c.slot);
    const want = labelRect(sheet, col, row, options.nudge);
    const dx = c.got.x - want.x;
    const dy = c.got.y - want.y;
    // Corners must be exact. Widths are whole pixels (see snapColumns): up to 1 px narrower than the die cut, never wider.
    const dw = c.got.width - want.width;
    const bad = Math.abs(dx) > TOL || Math.abs(dy) > TOL || dw > TOL || dw < -MAX_NARROWER || Math.abs(c.got.height - want.height) > TOL;
    if (bad) failed = true;
    console.log(
      `  ${c.what.padEnd(11)} top-left  pdf (${f(c.got.x)}, ${f(c.got.y)}) mm  registry (${f(want.x)}, ${f(want.y)})  off (${f(dx)}, ${f(dy)})  size ${f(c.got.width)} x ${f(c.got.height)}  ${bad ? "FAIL" : "ok"}`
    );
  }

  // The alignment sheet must draw its outlines at the same places.
  const align = await renderPdf(alignElement(ctx, run), { fonts });
  const outlines = measurePdf(align.pdf)[0].strokes.filter(
    (s) => Math.abs(s.width - sheet.labelWidth) < 0.1 && Math.abs(s.height - sheet.labelHeight) < 0.1
  );
  if (countPages(align.pdf) !== 1 || outlines.length !== sheet.perSheet) {
    failed = true;
    console.log(`  alignment: ${countPages(align.pdf)} page(s), ${outlines.length} outlines (expected 1 and ${sheet.perSheet}) FAIL`);
  } else {
    let worst = 0;
    outlines.forEach((o, i) => {
      const want = labelRect(sheet, i % sheet.columns, Math.floor(i / sheet.columns), options.nudge);
      worst = Math.max(worst, Math.abs(o.x - want.x), Math.abs(o.y - want.y));
    });
    if (worst > TOL) failed = true;
    console.log(`  alignment   ${outlines.length} outlines, worst offset ${f(worst)} mm  ${worst > TOL ? "FAIL" : "ok"}`);
  }
}

console.log(failed ? "\nVerification FAILED." : "\nAll measured corners match the registry geometry.");
process.exitCode = failed ? 1 : 0;

import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { ElementsError, formatDiagnostics, render, validate, type Diagnostic } from "@hyper-elements/react";
import { renderImage } from "@hyper-elements/react/image";
import { renderPdf } from "@hyper-elements/react/pdf";
import type { ReactElement } from "react";
import { USAGE, parseArgs } from "./cli";
import { summarise } from "./diagnostics";
import { loadFonts } from "./fonts";
import { planLabel } from "./label-layout";
import {
  alignElement,
  copyWebFonts,
  createContext,
  emailElement,
  labelElement,
  labelFileName,
  pantryElement,
  sheetElement,
} from "./run";

function logDiagnostics(label: string, diagnostics: Diagnostic[]): void {
  const lines = summarise(diagnostics);
  if (lines.length > 0) console.log(`[${label}] diagnostics:\n  ${lines.join("\n  ")}`);
}

function assertValid(label: string, element: ReactElement): void {
  const report = validate(element);
  if (!report.valid) throw new ElementsError(report.diagnostics);
  logDiagnostics(label, report.diagnostics);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }
  const ctx = createContext(options);
  const rel = (p: string): string => relative(process.cwd(), p) || p;
  const outDir = options.outDir;
  const labelsDir = join(outDir, "labels");
  await mkdir(labelsDir, { recursive: true });
  const fonts = loadFonts();

  console.log(
    `${ctx.labels.length} labels from ${ctx.jars.length} batches. Start position ${options.start}, nudge (${options.nudge.x}, ${options.nudge.y}) mm.`
  );

  // 1. Print sheets and alignment sheets (Document -> PDF)
  for (const run of ctx.runs) {
    const { sheet, pagination } = run;
    const doc = sheetElement(ctx, run);
    assertValid(`PDF:${sheet.id}`, doc);
    const { pdf, diagnostics } = await renderPdf(doc, { fonts });
    logDiagnostics(`renderPdf:${sheet.id}`, diagnostics);
    await writeFile(join(outDir, `${sheet.id}.pdf`), pdf);
    console.log(
      `Wrote ${rel(join(outDir, `${sheet.id}.pdf`))}: ${pagination.pages.length} page(s) of ${sheet.perSheet}, ` +
        `${pagination.blanksOnLast} blank(s) left on the last. Next --start ${pagination.nextStart}.`
    );

    const align = alignElement(ctx, run);
    assertValid(`PDF:${sheet.id}-align`, align);
    const alignRes = await renderPdf(align, { fonts });
    logDiagnostics(`renderPdf:${sheet.id}-align`, alignRes.diagnostics);
    await writeFile(join(outDir, `${sheet.id}-align.pdf`), alignRes.pdf);
    console.log(`Wrote ${rel(join(outDir, `${sheet.id}-align.pdf`))}`);
  }

  // Warn about any label whose text could not be fitted (never expected with the demo data).
  for (const run of ctx.runs) {
    for (const jar of ctx.jars) {
      if (!planLabel(jar, run.sheet).fits) console.warn(`Warning: "${jar.name}" does not fit a ${run.sheet.id} label cleanly. Shorten it.`);
    }
  }

  // 2. One PNG per unique label (Canvas -> PNG)
  for (const jar of ctx.jars) {
    const canvas = labelElement(ctx, jar);
    assertValid(`Canvas:${jar.batchCode}`, canvas);
    const { image, width, height, diagnostics } = await renderImage(canvas, { fonts, scale: 1, strict: true });
    logDiagnostics(`renderImage:${jar.batchCode}`, diagnostics);
    await writeFile(join(labelsDir, labelFileName(jar)), image);
    console.log(`Wrote ${rel(join(labelsDir, labelFileName(jar)))} (${width}x${height})`);
  }

  // 3. Pantry shelf (Page -> HTML)
  const pantry = pantryElement(ctx);
  assertValid("Page:pantry", pantry);
  const pantryRes = await render(pantry);
  logDiagnostics("render:pantry", pantryRes.diagnostics);
  await copyWebFonts(outDir);
  await writeFile(join(outDir, "pantry.html"), pantryRes.html, "utf8");
  console.log(`Wrote ${rel(join(outDir, "pantry.html"))} (reference date ${ctx.referenceDate})`);

  // 4. Print-run summary (Email -> HTML + text)
  const email = emailElement(ctx);
  assertValid("Email:print-run", email);
  const emailRes = await render(email);
  logDiagnostics("render:email", emailRes.diagnostics);
  await writeFile(join(outDir, "print-run-email.html"), emailRes.html, "utf8");
  await writeFile(join(outDir, "print-run-email.txt"), emailRes.text, "utf8");
  console.log(`Wrote ${rel(join(outDir, "print-run-email.html"))} and .txt`);
}

main().catch((err) => {
  if (err instanceof ElementsError) console.error(formatDiagnostics(err.diagnostics));
  else console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

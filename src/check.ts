import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { outline, validate, type Diagnostic } from "@hyper-elements/react";
import { emailClients, renderInEmailClients } from "@hyper-elements/email-clients";
import type { ReactElement } from "react";
import { parseArgs } from "./cli";
import { summarise } from "./diagnostics";
import { alignElement, createContext, emailElement, labelElement, pantryElement, sheetElement } from "./run";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const ctx = createContext(options);
  const plugin = await emailClients();
  let failed = false;

  const targets: Array<{ name: string; element: ReactElement; plugins?: unknown[] }> = [];
  for (const run of ctx.runs) {
    targets.push({ name: `Document sheet ${run.sheet.id}`, element: sheetElement(ctx, run) });
    targets.push({ name: `Document alignment ${run.sheet.id}`, element: alignElement(ctx, run) });
  }
  targets.push({ name: `Canvas label (${ctx.jars[0].batchCode})`, element: labelElement(ctx, ctx.jars[0]) });
  targets.push({ name: "Page pantry", element: pantryElement(ctx) });
  targets.push({ name: "Email print run", element: emailElement(ctx), plugins: [plugin] });

  for (const t of targets) {
    const report = validate(t.element, t.plugins ? ({ plugins: t.plugins } as never) : undefined);
    console.log(`\n=== ${t.name}: ${report.valid ? "VALID" : "INVALID"} ===`);
    const lines = summarise(report.diagnostics);
    console.log(lines.length ? lines.join("\n") : "No diagnostics.");
    if (!report.valid) failed = true;
  }

  console.log("\n=== Email outline ===");
  console.log(outline(emailElement(ctx)));

  // Email client emulation (Outlook, Gmail, Apple Mail, Gmail app).
  const clientsDir = join(options.outDir, "clients", "print-run-email");
  await mkdir(clientsDir, { recursive: true });
  const { previews, diagnostics } = await renderInEmailClients(emailElement(ctx), {
    emailClients: ["outlook", "gmail", "apple-mail", "gmail-app"],
  });
  for (const preview of previews) await writeFile(join(clientsDir, preview.filename), preview.html, "utf8");
  console.log(`\nWrote ${previews.length} email client emulator previews to ${relative(process.cwd(), clientsDir) || clientsDir}`);
  const emu: Diagnostic[] = diagnostics;
  const emuLines = summarise(emu);
  console.log(emuLines.length ? emuLines.join("\n") : "Email clients: no diagnostics.");
  if (summarise(emu, "error").length > 0) {
    console.error("Email client emulation reported errors.");
    failed = true;
  }

  if (failed) {
    console.error("\nCheck failed.");
    process.exitCode = 1;
  } else {
    console.log("\nAll checks passed.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

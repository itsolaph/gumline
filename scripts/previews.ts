/**
 * Builds the README preview images into ./previews from the files in ./out.
 *   - sheet and alignment pages: PDF -> PNG with pdftoppm (poppler-utils)
 *   - pantry page and email: screenshot with Chromium through playwright-core
 *   - a few label PNGs: copied as-is
 * Run `npm run build` first. Set CHROMIUM_PATH if Chromium is not auto-detected.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd();
const out = resolve(root, "out");
const previews = resolve(root, "previews");
mkdirSync(join(previews, "labels"), { recursive: true });

function chromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(base)) return undefined;
  for (const dir of readdirSync(base).filter((d) => d.startsWith("chromium")).sort().reverse()) {
    const p = join(base, dir, "chrome-linux64", "chrome");
    if (existsSync(p)) return p;
  }
  return undefined;
}

function pdfPage(pdf: string, name: string, dpi: number): void {
  execFileSync("pdftoppm", ["-r", String(dpi), "-f", "1", "-l", "1", "-png", "-singlefile", join(out, pdf), join(previews, name)]);
  console.log(`previews/${name}.png`);
}

pdfPage("L7160.pdf", "sheet-L7160", 110);
pdfPage("5163.pdf", "sheet-5163", 90);
pdfPage("L7651.pdf", "sheet-L7651", 110);
pdfPage("L7160-align.pdf", "align-L7160", 90);

for (const name of readdirSync(join(out, "labels"))) {
  if (/^(jam-2610-01|pkl-2610-01|hot-2611-01|cur-2610-01)/.test(name)) {
    copyFileSync(join(out, "labels", name), join(previews, "labels", name));
    console.log(`previews/labels/${name}`);
  }
}

const browser = await chromium.launch({ executablePath: chromiumPath() });
try {
  const page = await browser.newPage({ viewport: { width: 1040, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`file://${join(out, "pantry.html")}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(previews, "pantry.png"), fullPage: true });
  console.log("previews/pantry.png");
  const mail = await browser.newPage({ viewport: { width: 680, height: 900 }, deviceScaleFactor: 1 });
  await mail.goto(`file://${join(out, "print-run-email.html")}`);
  await mail.waitForTimeout(300);
  await mail.screenshot({ path: join(previews, "print-run-email.png"), fullPage: true });
  console.log("previews/print-run-email.png");
} finally {
  await browser.close();
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validate } from "@hyper-elements/react";
import { renderPdf } from "@hyper-elements/react/pdf";
import { emailClients } from "@hyper-elements/email-clients";
import { parseArgs } from "./cli";
import { deriveJars, expandLabels, latestBatchDate, loadJars, parseCsv, parseProducts } from "./data";
import { addMonths, daysBetween, formatLong } from "./dates";
import { summarise } from "./diagnostics";
import { loadFonts, textWidth } from "./fonts";
import {
  PX_PER_MM,
  allRects,
  assertOnPage,
  labelRect,
  loadRawSheets,
  loadSheets,
  paginate,
  slotToCell,
} from "./geometry";
import { buildInventory } from "./inventory";
import { SAFE_INSET, RULE_WIDTH, planLabel, tierFor } from "./label-layout";
import { colorMatches, countPages, measurePdf } from "./pdfmeasure";
import { alignElement, createContext, emailElement, labelElement, pantryElement, sheetElement } from "./run";
import { PALETTE } from "./theme";

const sheets = loadSheets();
const byId = (id: string) => sheets.find((s) => s.id === id)!;
const EPS = 1e-6;

describe("sheet registry geometry", () => {
  it("has the five stock layouts", () => {
    assert.deepEqual(sheets.map((s) => s.id), ["L7160", "L7163", "L7651", "5160", "5163"]);
  });

  it("converts inch sheets to millimetres exactly", () => {
    const s = byId("5160");
    assert.equal(s.labelWidth, 66.675);
    assert.equal(s.labelHeight, 25.4);
    assert.equal(s.marginTop, 12.7);
    assert.equal(s.marginLeft, 4.7625);
    assert.equal(s.pitchX, 69.85);
  });

  for (const sheet of loadSheets()) {
    it(`${sheet.id}: count is columns x rows`, () => {
      assert.equal(allRects(sheet).length, sheet.columns * sheet.rows);
      assert.equal(sheet.perSheet, sheet.columns * sheet.rows);
    });

    it(`${sheet.id}: every label lies inside the ${sheet.page} page`, () => {
      for (const r of allRects(sheet)) {
        assert.ok(r.x >= -EPS && r.y >= -EPS, `${sheet.id} label starts off-page`);
        assert.ok(r.x + r.width <= sheet.pageWidth + EPS, `${sheet.id} label runs past the right edge`);
        assert.ok(r.y + r.height <= sheet.pageHeight + EPS, `${sheet.id} label runs past the bottom edge`);
      }
    });

    it(`${sheet.id}: labels do not overlap`, () => {
      const rects = allRects(sheet);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          const overlapX = a.x < b.x + b.width - EPS && b.x < a.x + a.width - EPS;
          const overlapY = a.y < b.y + b.height - EPS && b.y < a.y + a.height - EPS;
          assert.ok(!(overlapX && overlapY), `${sheet.id}: labels ${i + 1} and ${j + 1} overlap`);
        }
      }
    });
  }

  it("every sheet in the registry carries every geometry field", () => {
    for (const raw of loadRawSheets()) {
      for (const v of [raw.label.width, raw.label.height, raw.grid.columns, raw.grid.rows, raw.margin.top, raw.margin.left, raw.pitch.x, raw.pitch.y, raw.cornerRadius]) {
        assert.ok(Number.isFinite(v) && v > 0, `${raw.id} has a bad value`);
      }
    }
  });
});

describe("start position and nudge", () => {
  it("--start N skips the first N-1 positions, row by row (L7160 has 3 columns)", () => {
    const sheet = byId("L7160");
    // Position 7 is column 1, row 3 (1-based) = (0, 2) 0-based; position 8, the next one, is (1, 2).
    assert.deepEqual(slotToCell(sheet, 7 - 1), { col: 0, row: 2 });
    assert.deepEqual(slotToCell(sheet, 8 - 1), { col: 1, row: 2 });
    assert.deepEqual(slotToCell(sheet, 1 - 1), { col: 0, row: 0 });
    const p = paginate(10, 8, sheet.perSheet);
    assert.equal(p.pages[0].slots.indexOf(0), 7);
    assert.deepEqual(p.pages[0].slots.slice(0, 7), Array(7).fill(null));
  });

  it("nudge shifts every coordinate by exactly that much", () => {
    const sheet = byId("L7160");
    const plain = allRects(sheet);
    const nudged = allRects(sheet, { x: 0.8, y: -0.5 });
    plain.forEach((r, i) => {
      assert.ok(Math.abs(nudged[i].x - (r.x + 0.8)) < EPS);
      assert.ok(Math.abs(nudged[i].y - (r.y - 0.5)) < EPS);
      assert.equal(nudged[i].width, r.width);
    });
    assert.deepEqual(labelRect(sheet, 0, 0), { x: 7.2, y: 15.15, width: 63.5, height: 38.1 });
  });

  it("refuses a nudge that would push labels off the page", () => {
    assert.throws(() => assertOnPage(byId("L7651"), { x: -6, y: 0 }), /off the A4 page/);
    assert.doesNotThrow(() => assertOnPage(byId("L7651"), { x: -4, y: -10 }));
  });
});

describe("pagination", () => {
  it("N labels from start S take ceil((S-1+N)/perSheet) pages", () => {
    for (const perSheet of [14, 21, 30, 65]) {
      for (const start of [1, 2, 8, perSheet]) {
        for (const n of [0, 1, 13, 21, 22, 45, 100]) {
          const p = paginate(n, start, perSheet);
          assert.equal(p.pages.length, Math.ceil((start - 1 + n) / perSheet), `perSheet ${perSheet} start ${start} n ${n}`);
          const placed = p.pages.flatMap((pg) => pg.slots).filter((s) => s !== null);
          assert.equal(placed.length, n);
          assert.deepEqual(placed, Array.from({ length: n }, (_, i) => i));
        }
      }
    }
  });

  it("counts blanks on the last page and the next start position", () => {
    const a = paginate(45, 1, 21);
    assert.equal(a.pages.length, 3);
    assert.equal(a.blanksOnLast, 18);
    assert.equal(a.nextStart, 4);
    assert.equal(a.pages[2].slots.filter((s) => s === null).length, 18);

    const b = paginate(42, 1, 21);
    assert.equal(b.blanksOnLast, 0);
    assert.equal(b.nextStart, 1);

    const c = paginate(20, 8, 21);
    assert.equal(c.pages.length, 2);
    assert.equal(c.blanksOnLast, 21 - ((7 + 20) % 21));
    assert.equal(c.nextStart, ((7 + 20) % 21) + 1);
  });

  it("rejects a start outside the sheet", () => {
    assert.throws(() => paginate(5, 0, 21), RangeError);
    assert.throws(() => paginate(5, 22, 21), RangeError);
    assert.throws(() => paginate(5, 1.5, 21), RangeError);
  });
});

describe("dates", () => {
  it("adds months and clamps to the end of the month", () => {
    assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
    assert.equal(addMonths("2026-03-31", 1), "2026-04-30");
    assert.equal(addMonths("2026-08-31", 6), "2027-02-28");
    assert.equal(addMonths("2026-11-30", 3), "2027-02-28");
    assert.equal(addMonths("2026-10-31", 12), "2027-10-31");
    assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
    assert.equal(addMonths("2026-11-22", 0), "2026-11-22");
    assert.equal(addMonths("2024-02-29", 12), "2025-02-28");
  });

  it("counts days between dates across month and leap-year boundaries", () => {
    assert.equal(daysBetween("2026-11-08", "2026-12-06"), 28);
    assert.equal(daysBetween("2028-02-28", "2028-03-01"), 2);
    assert.equal(daysBetween("2027-03-01", "2026-03-01"), -365);
  });

  it("rejects impossible dates", () => {
    assert.throws(() => addMonths("2026-02-30", 1));
    assert.throws(() => addMonths("26-02-01", 1));
  });

  it("formats dates without time-zone drift", () => {
    assert.equal(formatLong("2026-01-01"), "1 Jan 2026");
  });
});

describe("csv, batch codes and derived fields", () => {
  it("parses quoted fields and doubled quotes", () => {
    assert.deepEqual(parseCsv('a,"b,c","d ""e"""\n1,2,3\n'), [["a", "b,c", 'd "e"'], ["1", "2", "3"]]);
  });

  it("derives best-before and batch codes in CSV order per code and month", () => {
    const jars = deriveJars(
      parseProducts(
        "name,variety,batch_date,shelf_life_months,quantity,allergens,accent,code\n" +
          "Plum Jam,,2026-11-03,12,2,,plum,jam\n" +
          "Fig Jam,,2026-11-20,12,1,,plum,jam\n" +
          "Fig Jam,,2026-10-31,1,1,,plum,jam\n" +
          "Beans,,2026-11-05,6,1,\"mustard; celery\",pickle,\n"
      )
    );
    assert.deepEqual(jars.map((j) => j.batchCode), ["JAM-2611-01", "JAM-2611-02", "JAM-2610-01", "BEA-2611-01"]);
    assert.equal(jars[2].bestBefore, "2026-11-30");
    assert.deepEqual(jars[3].allergens, ["mustard", "celery"]);
    assert.equal(expandLabels(jars).length, 5);
    assert.equal(latestBatchDate(jars), "2026-11-20");
  });

  it("numbers batches by batch date, not CSV order", () => {
    const jars = deriveJars(
      parseProducts(
        "name,batch_date,shelf_life_months,quantity,code\n" +
          "Green Tomato Chutney,2026-10-26,18,1,CHT\n" +
          "Tomato Relish,2026-10-04,2,1,CHT\n" +
          "Same Day,2026-10-04,2,1,CHT\n"
      )
    );
    assert.deepEqual(jars.map((j) => j.batchCode), ["CHT-2610-03", "CHT-2610-01", "CHT-2610-02"]);
    const demo = loadJars();
    assert.equal(demo.find((j) => j.name === "Tomato Relish")!.batchCode, "CHT-2610-01");
    assert.equal(demo.find((j) => j.name === "Green Tomato Chutney")!.batchCode, "CHT-2610-02");
  });

  it("reports bad rows with a line number", () => {
    assert.throws(() => parseProducts("name,batch_date,shelf_life_months,quantity\nX,2026-02-30,1,1\n"), /line 2/);
    assert.throws(() => parseProducts("name,batch_date,shelf_life_months,quantity\nX,2026-02-01,x,1\n"), /shelf_life_months/);
    assert.throws(() => parseProducts("name,batch_date\nX,2026-02-01\n"), /missing the "shelf_life_months"/);
  });

  it("loads the demo pantry", () => {
    const jars = loadJars();
    assert.equal(jars.length, 10);
    assert.equal(expandLabels(jars).length, 45);
    assert.equal(new Set(jars.map((j) => j.batchCode)).size, jars.length);
  });
});

describe("inventory", () => {
  const jars = loadJars();
  const ref = latestBatchDate(jars);

  it("sorts by best-before and flags items within 30 days", () => {
    const rows = buildInventory(jars, ref);
    const dates = rows.map((r) => r.jar.bestBefore);
    assert.deepEqual(dates, [...dates].sort());
    const soon = rows.filter((r) => r.status === "soon");
    assert.ok(soon.length >= 2, "demo data should show some use-soon items");
    for (const r of rows) assert.equal(r.status === "soon", r.daysLeft >= 0 && r.daysLeft <= 30);
  });

  it("is deterministic and uses the given reference date", () => {
    assert.deepEqual(buildInventory(jars, ref), buildInventory(jars, ref));
    const far = buildInventory(jars, "2030-01-01");
    assert.ok(far.every((r) => r.status === "past"));
  });
});

describe("label layout", () => {
  const jars = loadJars();

  it("picks a tier by label size", () => {
    assert.equal(tierFor(byId("L7651")), "tiny");
    assert.equal(tierFor(byId("5160")), "compact");
    assert.equal(tierFor(byId("L7160")), "standard");
    assert.equal(tierFor(byId("L7163")), "wide");
    assert.equal(tierFor(byId("5163")), "wide");
  });

  for (const sheet of loadSheets()) {
    it(`${sheet.id}: every demo label fits inside the safe area without clipping`, () => {
      for (const jar of jars) {
        const plan = planLabel(jar, sheet);
        assert.ok(plan.fits, `${jar.name} does not fit ${sheet.id} (${plan.usedHeight.toFixed(1)} of ${plan.contentHeight.toFixed(1)} mm)`);
        assert.ok(plan.usedHeight <= plan.contentHeight + EPS);
        // Nothing may touch the die-cut edge: text lives inside the rule border, which sits SAFE_INSET in.
        const inset = SAFE_INSET + RULE_WIDTH + plan.pad;
        assert.ok(plan.contentWidth <= sheet.labelWidth - 2 * inset + EPS);
        for (const line of plan.name.lines) {
          assert.ok(textWidth(line, "display", plan.name.size) <= plan.contentWidth - plan.asideWidth * (plan.tier === "wide" ? 1 : 0), `${jar.name}: "${line}" is too wide`);
        }
        if (plan.tier === "tiny" || plan.tier === "compact") {
          assert.equal(plan.allergens, null);
        }
      }
    });
  }

  it("tiny labels carry only name and batch code", () => {
    const plan = planLabel(jars[0], byId("L7651"));
    assert.equal(plan.variety, null);
    assert.equal(plan.allergens, null);
    assert.equal(plan.code.text, jars[0].batchCode);
  });

  it("standard and wide labels carry variety, dates and allergens", () => {
    const pickles = jars.find((j) => j.allergens.length)!;
    for (const id of ["L7160", "L7163", "5163"]) {
      const plan = planLabel(pickles, byId(id));
      assert.ok(plan.variety, `${id} variety`);
      assert.ok(plan.allergens, `${id} allergens`);
      assert.equal(plan.made.length > 0 && plan.bestBefore.length > 0, true);
    }
  });
});

describe("cli", () => {
  it("parses flags", () => {
    const o = parseArgs(["--sheet", "L7160,5160", "--sheet", "L7651", "--start", "8", "--nudge-x", "0.8", "--nudge-y", "-0.5", "--today", "2026-12-01", "--tint"], "/tmp");
    assert.deepEqual(o.sheets, ["L7160", "5160", "L7651"]);
    assert.equal(o.start, 8);
    assert.deepEqual(o.nudge, { x: 0.8, y: -0.5 });
    assert.equal(o.referenceDate, "2026-12-01");
    assert.equal(o.tint, true);
  });

  it("rejects bad input", () => {
    assert.throws(() => parseArgs(["--start", "0"]));
    assert.throws(() => parseArgs(["--nudge-x", "abc"]));
    assert.throws(() => parseArgs(["--bogus"]));
    assert.throws(() => parseArgs(["--today", "2026-13-01"]));
  });
});

describe("Hyper Elements roots", () => {
  const ctx = createContext(parseArgs(["--start", "8"]));

  it("sheet and alignment Documents pass validate()", () => {
    for (const run of ctx.runs) {
      for (const el of [sheetElement(ctx, run), alignElement(ctx, run)]) {
        const report = validate(el);
        assert.ok(report.valid, `${run.sheet.id}: ${summarise(report.diagnostics).join("; ")}`);
        assert.deepEqual(summarise(report.diagnostics), []);
      }
    }
  });

  it("Canvas, Page and Email pass validate()", async () => {
    const plugin = await emailClients();
    const canvas = validate(labelElement(ctx, ctx.jars[0]));
    assert.ok(canvas.valid, summarise(canvas.diagnostics).join("; "));
    const page = validate(pantryElement(ctx));
    assert.ok(page.valid, summarise(page.diagnostics).join("; "));
    const email = validate(emailElement(ctx), { plugins: [plugin] } as never);
    assert.ok(email.valid, summarise(email.diagnostics).join("; "));
    assert.deepEqual(summarise(email.diagnostics, "error"), []);
  });
});

describe("rendered PDF geometry", () => {
  const fonts = loadFonts();

  it("places every label where the registry says, with start and nudge applied", async () => {
    const nudge = { x: 0.8, y: -0.5 };
    const ctx = createContext(parseArgs(["--sheet", "L7160", "--start", "8", "--nudge-x", "0.8", "--nudge-y", "-0.5", "--tint"]));
    const run = ctx.runs[0];
    const { pdf } = await renderPdf(sheetElement(ctx, run), { fonts });
    assert.equal(countPages(pdf), Math.ceil((7 + 45) / 21));
    assert.equal(countPages(pdf), run.pagination.pages.length);

    const pages = measurePdf(pdf);
    assert.equal(pages.length, 3);
    run.pagination.pages.forEach((page, p) => {
      const found = pages[p].rects.filter((r) => colorMatches(r.color, PALETTE.paper) && r.width < 100);
      const expected = page.slots.flatMap((idx, slot) => {
        if (idx === null) return [];
        const { col, row } = slotToCell(run.sheet, slot);
        return [labelRect(run.sheet, col, row, nudge)];
      });
      assert.equal(found.length, expected.length, `page ${p + 1}: label count`);
      expected.forEach((e, i) => {
        const f = found[i];
        assert.ok(Math.abs(f.x - e.x) < 0.02, `page ${p + 1} label ${i}: x ${f.x} vs ${e.x}`);
        assert.ok(Math.abs(f.y - e.y) < 0.02, `page ${p + 1} label ${i}: y ${f.y} vs ${e.y}`);
        assert.ok(Math.abs(f.width - e.width) < 0.02 && Math.abs(f.height - e.height) < 0.02, `page ${p + 1} label ${i}: size`);
      });
    });
    // Skipped slots render nothing: the first page's first painted label is position 8 (0-based column 1, row 2).
    const first = pages[0].rects.find((r) => colorMatches(r.color, PALETTE.paper) && r.width < 100)!;
    assert.ok(Math.abs(first.x - (7.2 + 66.04 + 0.8)) < 0.02);
    assert.ok(Math.abs(first.y - (15.15 + 2 * 38.1 - 0.5)) < 0.02);
  });

  it("every sheet keeps its published pitch, including fractional-pixel widths (L7163 regression)", async () => {
    for (const sheet of sheets) {
      const ctx = createContext(parseArgs(["--sheet", sheet.id, "--tint"]));
      const run = ctx.runs[0];
      const { pdf } = await renderPdf(sheetElement(ctx, run), { fonts });
      const [firstPage] = measurePdf(pdf);
      const painted = firstPage.rects.filter((r) => colorMatches(r.color, PALETTE.paper) && r.width < sheet.pageWidth / 2);
      assert.equal(painted.length, Math.min(45, sheet.perSheet), `${sheet.id}: labels on page 1`);
      painted.forEach((r, i) => {
        const want = labelRect(sheet, i % sheet.columns, Math.floor(i / sheet.columns));
        assert.ok(Math.abs(r.x - want.x) < 0.02, `${sheet.id} label ${i + 1}: x ${r.x} vs ${want.x}`);
        assert.ok(Math.abs(r.y - want.y) < 0.02, `${sheet.id} label ${i + 1}: y ${r.y} vs ${want.y}`);
        // Painted width is whole pixels: never wider than the die cut, at most one pixel narrower.
        assert.ok(r.width <= want.width + 0.02 && r.width >= want.width - 0.3, `${sheet.id} label ${i + 1}: width ${r.width}`);
        assert.ok(Math.abs(r.height - want.height) < 0.02);
      });
    }
  });

  it("the alignment sheet is one page", async () => {
    const ctx = createContext(parseArgs(["--sheet", "L7651", "--nudge-x", "0.5"]));
    const { pdf } = await renderPdf(alignElement(ctx, ctx.runs[0]), { fonts });
    assert.equal(countPages(pdf), 1);
  });

  it("px per mm is the CSS 96 dpi ratio", () => {
    assert.ok(Math.abs(PX_PER_MM * 25.4 - 96) < EPS);
  });
});

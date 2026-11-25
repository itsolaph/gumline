import { formatLong, formatShort } from "./dates";
import { textWidth, type FontKey } from "./fonts";
import type { Jar, Sheet } from "./types";

/**
 * Pure label layout: decides tier, font sizes and line breaks in millimetres using real font
 * metrics, so the renderers only draw what was measured and tests can prove nothing overflows.
 *
 * Every tier stacks header / middle (name + variety) / footer. Whatever height is left over is
 * split into two equal spacers around the middle, so one-line and two-line titles both sit
 * deliberately between header and footer instead of leaving a hole.
 */

export type Tier = "tiny" | "compact" | "standard" | "wide";

/** Die-cut edge to the thin rule border. Nothing is ever drawn outside the rule. */
export const SAFE_INSET = 1.5;
export const RULE_WIDTH = 0.3;
/** Measured widths are shrunk by this factor before comparing, to absorb renderer differences. */
const SLACK = 0.94;

/** MADE / BEST BEFORE captions: 2.3 mm is 6.5 pt at print size. */
export const CAPTION_SIZE = 2.3;
export const CAPTION_TRACKING = 0.12; // em
/** Space between the allergen line and the divider under it. */
export const ALLERGEN_GAP = 1.8;
export const DIVIDER = 0.2;
export const DIVIDER_GAP = 0.9;
export const NAME_VARIETY_GAP = 0.6;
/** Standard tier: least space under the batch-code rule, so two-line titles get the headroom one-line titles have. */
const STANDARD_MIN_GAP = 1.6;

export interface TextBlock {
  lines: string[];
  size: number; // mm
  lineHeight: number; // multiple of size
}

export interface LabelPlan {
  tier: Tier;
  /** Label size in mm. */
  width: number;
  height: number;
  pad: number;
  /** Space inside the padding, in mm. */
  contentWidth: number;
  contentHeight: number;
  stripe: number; // mm, 0 for none
  name: TextBlock;
  variety: TextBlock | null;
  allergens: TextBlock | null;
  code: { text: string; size: number };
  made: string;
  bestBefore: string;
  /** Wide tier: width of the date panel in mm. */
  asideWidth: number;
  /** Wide tier: gap between the text column and the date panel, in mm. */
  gutter: number;
  /** Wide tier: size of the date values in the panel, in mm. */
  asideDateSize: number;
  /** Caption size (MADE / BEST BEFORE), in mm. */
  captionSize: number;
  /** Height of the stacked content, without spacers, in mm. */
  usedHeight: number;
  /** Space above and below the middle block, in mm. */
  spacer: number;
  fits: boolean;
  /** Layout-scale used by the wide tier (1 for the others). */
  scale: number;
}

export function tierFor(sheet: Pick<Sheet, "labelWidth" | "labelHeight">): Tier {
  if (sheet.labelHeight < 23) return "tiny";
  if (sheet.labelHeight < 30) return "compact";
  return sheet.labelWidth >= 90 ? "wide" : "standard";
}

export const NAME_FONT: FontKey = "display";
export const VARIETY_FONT: FontKey = "displayItalic";
export const SMALL_FONT: FontKey = "sansBold";
export const CODE_FONT: FontKey = "mono";

function wrap(text: string, font: FontKey, size: number, maxWidth: number, spacing: number): string[] | null {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (textWidth(word, font, size, spacing) > maxWidth) return null;
    const trial = current ? `${current} ${word}` : word;
    if (current && textWidth(trial, font, size, spacing) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Greedy wrap, then squeeze the measure until the line count would grow: the same number of lines,
 * but of roughly even length, so a title never ends on a lone short word.
 */
function wrapBalanced(text: string, font: FontKey, size: number, maxWidth: number, spacing: number): string[] | null {
  const greedy = wrap(text, font, size, maxWidth, spacing);
  if (!greedy || greedy.length < 2) return greedy;
  let lo = 0;
  let hi = maxWidth;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const w = wrap(text, font, size, mid, spacing);
    if (w && w.length <= greedy.length) hi = mid;
    else lo = mid;
  }
  return wrap(text, font, size, hi, spacing) ?? greedy;
}

/** Largest listed size at which `text` wraps (balanced) into at most `maxLines` lines that fit `maxWidth`. */
export function fitLines(
  text: string,
  font: FontKey,
  sizes: number[],
  maxWidth: number,
  maxLines: number,
  lineHeight: number,
  spacingEm = 0
): TextBlock | null {
  for (const size of sizes) {
    const lines = wrapBalanced(text, font, size, maxWidth * SLACK, spacingEm * size);
    if (lines && lines.length <= maxLines) return { lines, size, lineHeight };
  }
  return null;
}

/**
 * Every size that fits, best first: a title that fits on one line at a slightly smaller size
 * (down to `oneLineFrac` of the largest) beats a two-line title at full size.
 */
export function titleOptions(
  text: string,
  sizes: number[],
  maxWidth: number,
  maxLines: number,
  lineHeight: number,
  oneLineFrac: number
): TextBlock[] {
  const all: TextBlock[] = [];
  for (const size of sizes) {
    const lines = wrapBalanced(text, NAME_FONT, size, maxWidth * SLACK, 0);
    if (lines && lines.length <= maxLines) all.push({ lines, size, lineHeight });
  }
  const threshold = sizes[0] * oneLineFrac;
  const preferred = all.filter((b) => b.lines.length === 1 && b.size >= threshold - 1e-9);
  return [...preferred, ...all.filter((b) => !preferred.includes(b))];
}

export const blockHeight = (b: TextBlock | null): number => (b ? b.lines.length * b.size * b.lineHeight : 0);

export function allergenText(jar: Jar): string {
  return jar.allergens.length ? `CONTAINS ${jar.allergens.join(", ").toUpperCase()}` : "";
}

const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let s = from; s >= to - 1e-9; s -= step) out.push(Math.round(s * 100) / 100);
  return out;
};

interface Choice {
  name: TextBlock;
  variety: TextBlock | null;
  content: number;
  ok: boolean;
}

/**
 * Keep the variety as long as possible: for each variety option (best first) try every title size
 * (best first) and take the first stack that leaves at least `minGap` above and below the middle.
 */
function choose(
  names: TextBlock[],
  varieties: Array<TextBlock | null>,
  contentOf: (name: TextBlock, variety: TextBlock | null) => number,
  ch: number,
  minGap: number,
  fallbackName: string
): Choice {
  for (const v of varieties) {
    for (const n of names) {
      const content = contentOf(n, v);
      if ((ch - content) / 2 >= minGap - 1e-9) return { name: n, variety: v, content, ok: true };
    }
  }
  const n: TextBlock = names[names.length - 1] ?? { lines: [fallbackName], size: 2.2, lineHeight: 1.08 };
  return { name: n, variety: null, content: contentOf(n, null), ok: false };
}

const planCache = new Map<string, LabelPlan>();

/** Memoised: a sheet draws the same jar many times. */
export function planLabel(jar: Jar, sheet: Pick<Sheet, "labelWidth" | "labelHeight">): LabelPlan {
  const key = JSON.stringify([jar.name, jar.variety, jar.allergens, jar.batchCode, jar.batchDate, jar.bestBefore, sheet.labelWidth, sheet.labelHeight]);
  let plan = planCache.get(key);
  if (!plan) {
    plan = computePlan(jar, sheet);
    planCache.set(key, plan);
  }
  return plan;
}

function computePlan(jar: Jar, sheet: Pick<Sheet, "labelWidth" | "labelHeight">): LabelPlan {
  const tier = tierFor(sheet);
  const pad = tier === "tiny" ? 1.0 : tier === "compact" ? 1.2 : 1.4;
  const inset = SAFE_INSET + RULE_WIDTH + pad;
  const cw = sheet.labelWidth - 2 * inset;
  const ch = sheet.labelHeight - 2 * inset;
  const base = {
    tier,
    width: sheet.labelWidth,
    height: sheet.labelHeight,
    pad,
    contentWidth: cw,
    contentHeight: ch,
    allergens: null as TextBlock | null,
    asideWidth: 0,
    gutter: 0,
    asideDateSize: 0,
    captionSize: CAPTION_SIZE,
    scale: 1,
    made: formatShort(jar.batchDate),
    bestBefore: formatShort(jar.bestBefore),
  };
  const allergenLine = allergenText(jar);
  const finish = (c: Choice, minGap: number, extra: Partial<LabelPlan>, widthLimit: number, codeSize: number, stripe = 0): LabelPlan => {
    const widest = Math.max(...c.name.lines.map((l) => textWidth(l, NAME_FONT, c.name.size)));
    return {
      ...base,
      stripe,
      name: c.name,
      variety: c.variety,
      code: { text: jar.batchCode, size: codeSize },
      usedHeight: c.content,
      spacer: (ch - c.content) / 2,
      fits: c.ok && widest <= widthLimit + 1e-9 && (ch - c.content) / 2 >= minGap - 1e-9,
      ...extra,
    };
  };

  if (tier === "tiny") {
    const stripe = 0.8;
    const codeSize = 1.9;
    const names = titleOptions(jar.name, range(3.5, 2.2, 0.1), cw, 2, 1.08, 0.8);
    const c = choose(names, [null], (n) => stripe + blockHeight(n) + codeSize * 1.2, ch, 0.7, jar.name);
    return finish(c, 0.7, {}, cw, codeSize, stripe);
  }

  if (tier === "compact") {
    const codeSize = 2.1;
    const footer = 3.5;
    const names = titleOptions(jar.name, range(5.2, 2.6, 0.1), cw, 2, 1.05, 0.68);
    const variety = jar.variety ? fitLines(jar.variety, VARIETY_FONT, range(2.6, 2.0, 0.1), cw, 1, 1.2) : null;
    const c = choose(
      names,
      variety ? [variety, null] : [null],
      (n, v) => blockHeight(n) + (v ? 0.8 + blockHeight(v) : 0) + footer,
      ch,
      0.9,
      jar.name
    );
    return finish(c, 0.9, {}, cw, codeSize);
  }

  if (tier === "standard") {
    const codeSize = 2.1;
    const header = codeSize * 1.2;
    const allergens = allergenLine
      ? (fitLines(allergenLine, SMALL_FONT, range(2.4, 1.8, 0.1), cw, 1, 1.2, 0.06) ??
        fitLines(allergenLine, SMALL_FONT, range(2.2, 1.8, 0.1), cw, 2, 1.2, 0.06))
      : null;
    const footer = (allergens ? blockHeight(allergens) + ALLERGEN_GAP : 0) + DIVIDER + DIVIDER_GAP + (CAPTION_SIZE + 3.0) * 1.2;
    const names = titleOptions(jar.name, range(6.2, 3.4, 0.1), cw, 2, 1.04, 0.78);
    const varieties: Array<TextBlock | null> = jar.variety
      ? [
          fitLines(jar.variety, VARIETY_FONT, range(2.8, 2.2, 0.1), cw, 2, 1.2),
          fitLines(jar.variety, VARIETY_FONT, range(2.2, 1.9, 0.1), cw, 3, 1.2),
          fitLines(jar.variety, VARIETY_FONT, range(2.2, 1.9, 0.1), cw, 1, 1.2),
          null,
        ].filter((v, i, a) => v === null || a.indexOf(v) === i)
      : [null];
    const c = choose(names, varieties, (n, v) => header + blockHeight(n) + (v ? NAME_VARIETY_GAP + blockHeight(v) : 0) + footer, ch, STANDARD_MIN_GAP, jar.name);
    return finish(c, STANDARD_MIN_GAP, { allergens }, cw, codeSize);
  }

  // wide: text column on the left, date panel on the right. Sizes scale with the label's height,
  // and a generous gutter keeps the title away from the panel.
  const k = Math.max(1, Math.min(ch / 31.7, 1.5));
  const asideWidth = Math.min(30 * k, cw * 0.34);
  const gutter = 4.5 * k;
  const mainW = cw - asideWidth - gutter;
  const codeSize = 2.2 * k;
  const header = codeSize * 1.2;
  const allergens = allergenLine
    ? fitLines(allergenLine, SMALL_FONT, range(2.2 * k, 1.7 * k, 0.1), mainW, 1, 1.2, 0.06)
    : null;
  const footer = allergens ? blockHeight(allergens) : 0;
  const names = titleOptions(jar.name, range(6.6 * k, 3.6, 0.1), mainW, 2, 1.04, 0.78);
  const varieties: Array<TextBlock | null> = jar.variety
    ? [
        fitLines(jar.variety, VARIETY_FONT, range(3.0 * k, 2.2, 0.1), mainW, 3, 1.2),
        fitLines(jar.variety, VARIETY_FONT, range(2.6, 2.0, 0.1), mainW, 2, 1.2),
        null,
      ].filter((v, i, a) => v === null || a.indexOf(v) === i)
    : [null];
  const gap = NAME_VARIETY_GAP * k;
  const c = choose(names, varieties, (n, v) => header + blockHeight(n) + (v ? gap + blockHeight(v) : 0) + footer, ch, 0.7 * k, jar.name);
  const captionSize = CAPTION_SIZE * Math.min(k, 1.25);
  return finish(
    c,
    0.7 * k,
    {
      allergens,
      asideWidth,
      gutter,
      captionSize,
      asideDateSize: Math.min(
        3.4 * k,
        ...[formatLong(jar.batchDate), formatLong(jar.bestBefore)].map(
          (d) => ((asideWidth - 3 * k) * SLACK) / textWidth(d, SMALL_FONT, 1)
        )
      ),
      scale: k,
      made: formatLong(jar.batchDate),
      bestBefore: formatLong(jar.bestBefore),
    },
    mainW,
    codeSize
  );
}

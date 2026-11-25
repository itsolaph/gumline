import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { create, type Font } from "fontkit";

export interface LoadedFont {
  family: string;
  src: Uint8Array;
  weight: number;
  style: "normal" | "italic";
}

const require_ = createRequire(import.meta.url);

function fontFile(relPath: string): string {
  return require_.resolve(relPath);
}

export const FONT_SPECS = [
  { key: "display", family: "Fraunces", file: "@fontsource/fraunces/files/fraunces-latin-700-normal.woff", weight: 700, style: "normal" },
  { key: "displayItalic", family: "Fraunces", file: "@fontsource/fraunces/files/fraunces-latin-400-italic.woff", weight: 400, style: "italic" },
  { key: "sans", family: "DM Sans", file: "@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff", weight: 400, style: "normal" },
  { key: "sansMedium", family: "DM Sans", file: "@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff", weight: 500, style: "normal" },
  { key: "sansBold", family: "DM Sans", file: "@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff", weight: 700, style: "normal" },
  { key: "mono", family: "IBM Plex Mono", file: "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff", weight: 500, style: "normal" },
  { key: "monoBold", family: "IBM Plex Mono", file: "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff", weight: 600, style: "normal" },
] as const;

export type FontKey = (typeof FONT_SPECS)[number]["key"];

/** Font files for renderPdf / renderImage (TTF, OTF or WOFF; not WOFF2). */
export function loadFonts(): LoadedFont[] {
  return FONT_SPECS.map((s) => ({
    family: s.family,
    src: new Uint8Array(readFileSync(fontFile(s.file))),
    weight: s.weight,
    style: s.style,
  }));
}

const cache = new Map<FontKey, Font>();

function fontFor(key: FontKey): Font {
  let font = cache.get(key);
  if (!font) {
    const spec = FONT_SPECS.find((s) => s.key === key)!;
    font = create(readFileSync(fontFile(spec.file))) as Font;
    cache.set(key, font);
  }
  return font;
}

/** Width of `text` set in `key` at `size` (any unit), with `letterSpacing` (same unit) after every glyph. */
export function textWidth(text: string, key: FontKey, size: number, letterSpacing = 0): number {
  const font = fontFor(key);
  const run = font.layout(text);
  return (run.advanceWidth / font.unitsPerEm) * size + letterSpacing * [...text].length;
}

/** Path of the WOFF2 for a web font, for the HTML page. */
export function woff2Path(pkg: string, file: string): string {
  return fontFile(`@fontsource/${pkg}/files/${file}`);
}

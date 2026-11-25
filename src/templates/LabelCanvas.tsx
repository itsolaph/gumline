import { Canvas } from "@hyper-elements/react";
import { Label } from "../components/Label";
import { PALETTE, gumlineTheme } from "../theme";
import type { Jar, Sheet } from "../types";

/** Pixels per millimetre for label PNGs: about 300 dpi. */
export const PNG_PX_PER_MM = 12;

export function labelCanvasSize(sheet: Pick<Sheet, "labelWidth" | "labelHeight">): { width: number; height: number; u: number } {
  const width = Math.round(sheet.labelWidth * PNG_PX_PER_MM);
  return { width, height: Math.round(sheet.labelHeight * (width / sheet.labelWidth)), u: width / sheet.labelWidth };
}

/** One label as a standalone image (for sharing, or a shop listing). Same Label component as the PDF. */
export function LabelCanvas({ jar, sheet }: { jar: Jar; sheet: Pick<Sheet, "labelWidth" | "labelHeight" | "cornerRadius"> }) {
  const { width, height, u } = labelCanvasSize(sheet);
  return (
    <Canvas
      width={width}
      height={height}
      theme={gumlineTheme}
      title={`${jar.batchCode} ${jar.name}`}
      lang="en"
      style={{ backgroundColor: PALETTE.card, padding: 0 }}
    >
      <Label jar={jar} sheet={sheet} u={u} paper />
    </Canvas>
  );
}

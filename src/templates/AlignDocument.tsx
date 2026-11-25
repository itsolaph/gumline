import { Column, Document, Layer, Line, Rect, Row, Svg, Text } from "@hyper-elements/react";
import { labelRect, mmToPx, snapColumns } from "../geometry";
import { FONT_STACK, gumlineTheme } from "../theme";
import type { Nudge, Sheet } from "../types";

const OUTLINE = "#1D6F8C";
const CROSS = "#C2412B";
const TICK = "#3A3A3A";

export interface AlignDocumentProps {
  sheet: Sheet;
  nudge: Nudge;
}

const fmt = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

/**
 * One page of outlines, centre crosshairs and a mm ruler along the top and left edges.
 * Print it on plain paper at 100% and hold it against a label sheet to the light. Outlines carry
 * the printer nudge; the ruler does not move, so you can read the offset straight off it.
 */
export function AlignDocument({ sheet, nudge }: AlignDocumentProps) {
  const W = sheet.pageWidth;
  const H = sheet.pageHeight;
  const px = mmToPx;

  const ticksTop = Array.from({ length: Math.floor(W) + 1 }, (_, i) => i);
  const ticksLeft = Array.from({ length: Math.floor(H) + 1 }, (_, i) => i);
  const tickLen = (i: number): number => (i % 10 === 0 ? 2.4 : i % 5 === 0 ? 1.6 : 1.0);

  const cells: Array<{ n: number; x: number; y: number }> = [];
  for (let row = 0; row < sheet.rows; row++) {
    for (let col = 0; col < sheet.columns; col++) {
      const r = labelRect(sheet, col, row, nudge);
      cells.push({ n: row * sheet.columns + col + 1, x: r.x, y: r.y });
    }
  }
  const first = labelRect(sheet, 0, 0, nudge);
  const { widthPx, gapPx: gapX } = snapColumns(sheet);
  const gapY = px(sheet.pitchY - sheet.labelHeight);

  const topNumerals = Math.floor((W - 5) / 10);
  const leftNumerals = Math.floor((H - 10) / 10);
  const nudged = nudge.x !== 0 || nudge.y !== 0;

  return (
    <Document
      size={sheet.page}
      orientation="portrait"
      margin={0}
      theme={gumlineTheme}
      title={`Gumline alignment test ${sheet.id} (${sheet.page})`}
      lang="en"
      style={{ backgroundColor: "#FFFFFF" }}
    >
      <Document.Page style={{ backgroundColor: "#FFFFFF", gap: 0 }}>
        <Layer style={{ width: px(W), height: px(H) }}>
          {/* Geometry, in millimetre units */}
          <Svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`} title="Label outlines, crosshairs and mm ruler">
            {ticksTop.map((i) => (
              <Line key={`tt-${i}`} x1={i} y1={0} x2={i} y2={tickLen(i)} style={{ stroke: TICK, strokeWidth: i % 10 === 0 ? 0.2 : 0.12 }} />
            ))}
            {ticksLeft.map((i) => (
              <Line key={`tl-${i}`} x1={0} y1={i} x2={tickLen(i)} y2={i} style={{ stroke: TICK, strokeWidth: i % 10 === 0 ? 0.2 : 0.12 }} />
            ))}
            {cells.map((c) => (
              <Rect
                key={`o-${c.n}`}
                x={c.x}
                y={c.y}
                width={sheet.labelWidth}
                height={sheet.labelHeight}
                rx={sheet.cornerRadius}
                style={{ fill: "transparent", stroke: OUTLINE, strokeWidth: 0.25 }}
              />
            ))}
            {cells.flatMap((c) => {
              const cx = c.x + sheet.labelWidth / 2;
              const cy = c.y + sheet.labelHeight / 2;
              return [
                <Line key={`ch-${c.n}`} x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} style={{ stroke: CROSS, strokeWidth: 0.2 }} />,
                <Line key={`cv-${c.n}`} x1={cx} y1={cy - 3} x2={cx} y2={cy + 3} style={{ stroke: CROSS, strokeWidth: 0.2 }} />,
              ];
            })}
          </Svg>

          {/* Ruler numerals along the top edge (centimetres) */}
          <Row stackOnMobile={false} style={{ padding: [px(2.7), 0, 0, px(5)], gap: 0 }}>
            {Array.from({ length: topNumerals }, (_, k) => (
              <Column key={`nt-${k}`} style={{ width: px(10), flex: "none" }}>
                <Text style={{ fontFamily: FONT_STACK.body, fontWeight: 500, fontSize: px(1.7), lineHeight: 1.1, color: TICK, textAlign: "center" }}>
                  {k + 1}
                </Text>
              </Column>
            ))}
          </Row>

          {/* Ruler numerals down the left edge (centimetres) */}
          <Column style={{ padding: [px(10 - 0.9), 0, 0, px(2.5)], gap: 0 }}>
            {Array.from({ length: leftNumerals }, (_, k) => (
              <Column key={`nl-${k}`} style={{ width: px(2.1), height: px(10) }}>
                <Text style={{ fontFamily: FONT_STACK.body, fontWeight: 500, fontSize: px(1.5), lineHeight: 1.2, color: TICK }}>
                  {k + 1}
                </Text>
              </Column>
            ))}
          </Column>

          {/* Slot numbers, one per label, same footprint as the print sheet */}
          <Column style={{ padding: [px(first.y), 0, 0, px(first.x)], gap: gapY }}>
            {Array.from({ length: sheet.rows }, (_, row) => (
              <Row key={`sr-${row}`} stackOnMobile={false} style={{ gap: gapX, alignItems: "start" }}>
                {Array.from({ length: sheet.columns }, (_, col) => (
                  <Column key={`sc-${row}-${col}`} style={{ width: widthPx, height: px(sheet.labelHeight), flex: "none", padding: [px(1.0), 0, 0, px(1.6)] }}>
                    <Text style={{ fontFamily: FONT_STACK.mono, fontWeight: 600, fontSize: px(2.2), lineHeight: 1.1, color: OUTLINE }}>
                      {row * sheet.columns + col + 1}
                    </Text>
                  </Column>
                ))}
              </Row>
            ))}
          </Column>

          {/* Caption in the top margin */}
          <Column style={{ padding: [px(4.9), 0, 0, px(12)], width: px(W - 24) }}>
            <Text style={{ fontFamily: FONT_STACK.body, fontWeight: 700, fontSize: px(2.3), lineHeight: 1.2, color: "#222222" }}>
              Gumline alignment test · {sheet.brand} {sheet.id} · {sheet.page} · {sheet.columns} x {sheet.rows} = {sheet.perSheet} labels
            </Text>
            <Text style={{ fontFamily: FONT_STACK.body, fontWeight: 400, fontSize: px(2.0), lineHeight: 1.25, color: "#444444" }}>
              Print at 100% (no fit-to-page) on plain paper, hold against a label sheet to the light. Ruler numbers are cm.
              {nudged ? ` Outlines include nudge x ${fmt(nudge.x)} mm, y ${fmt(nudge.y)} mm.` : " No nudge applied."}
            </Text>
          </Column>
        </Layer>
      </Document.Page>
    </Document>
  );
}

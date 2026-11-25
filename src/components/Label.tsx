import { Column, Row, Span, Text } from "@hyper-elements/react";
import {
  ALLERGEN_GAP,
  CAPTION_TRACKING,
  CODE_FONT,
  DIVIDER,
  DIVIDER_GAP,
  NAME_VARIETY_GAP,
  RULE_WIDTH,
  SAFE_INSET,
  planLabel, type LabelPlan, type TextBlock } from "../label-layout";
import { textWidth } from "../fonts";
import { FONT_STACK, PALETTE, accentFor } from "../theme";
import type { Jar, Sheet } from "../types";

export interface LabelProps {
  jar: Jar;
  /** Label size and corner radius, in mm. */
  sheet: Pick<Sheet, "labelWidth" | "labelHeight" | "cornerRadius">;
  /** Pixels per millimetre. 96/25.4 for print PDFs; larger for PNGs. */
  u: number;
  /** Fill the label with warm paper colour. Off for print sheets, on for shareable PNGs. */
  paper?: boolean;
  /** Outer width in whole pixels (see snapColumns). Defaults to the exact width. */
  widthPx?: number;
}

function Lines({ block, u, font, color, weight, italic, transform }: {
  block: TextBlock;
  u: number;
  font: string;
  color: string;
  weight: 400 | 700;
  italic?: boolean;
  transform?: "uppercase";
}) {
  return (
    <Column style={{ gap: 0 }}>
      {block.lines.map((line, i) => (
        <Text
          key={i}
          style={{
            fontFamily: font,
            fontSize: block.size * u,
            lineHeight: block.lineHeight,
            fontWeight: weight,
            fontStyle: italic ? "italic" : "normal",
            color,
            textTransform: transform,
          }}
        >
          {line}
        </Text>
      ))}
    </Column>
  );
}

function CodeRow({ plan, u, color, rule }: { plan: LabelPlan; u: number; color: string; rule: boolean }) {
  const w = textWidth(plan.code.text, CODE_FONT, plan.code.size, plan.code.size * 0.04) * 1.1;
  return (
    <Row stackOnMobile={false} style={{ alignItems: "center", gap: 1.2 * u }}>
      <Column style={{ width: w * u, flex: "none" }}>
        <Text style={{ fontFamily: FONT_STACK.mono, fontWeight: 500, fontSize: plan.code.size * u, lineHeight: 1.2, letterSpacing: plan.code.size * 0.04 * u, color }}>
          {plan.code.text}
        </Text>
      </Column>
      {rule ? <Column style={{ height: 0.35 * u, flex: 1, backgroundColor: color }} /> : null}
    </Row>
  );
}

const Gap = ({ h, u }: { h: number; u: number }) => <Column style={{ height: Math.max(h, 0) * u }} />;

function DateBlock({ label, value, size, caption, u, color, align, inRow }: { label: string; value: string; size: number; caption: number; u: number; color: string; align?: "left" | "right"; inRow?: boolean }) {
  return (
    <Column style={{ flex: inRow ? 1 : undefined, gap: 0 }}>
      <Text style={{ fontFamily: FONT_STACK.body, fontWeight: 700, fontSize: caption * u, lineHeight: 1.2, letterSpacing: CAPTION_TRACKING * caption * u, color: PALETTE.inkSoft, textAlign: align ?? "left" }}>
        {label}
      </Text>
      <Text style={{ fontFamily: FONT_STACK.body, fontWeight: 700, fontSize: size * u, lineHeight: 1.2, color, textAlign: align ?? "left" }}>
        {value}
      </Text>
    </Column>
  );
}

export function Label({ jar, sheet, u, paper = false, widthPx }: LabelProps) {
  const plan = planLabel(jar, sheet);
  const outerW = widthPx ?? plan.width * u;
  const { accent, tint } = accentFor(jar.accent);
  const frameRadius = Math.max(sheet.cornerRadius - SAFE_INSET, 0.8);

  let body;
  if (plan.tier === "tiny") {
    body = (
      <>
        <Column style={{ height: plan.stripe * u, backgroundColor: accent, borderRadius: 0.4 * u }} />
        <Gap h={plan.spacer} u={u} />
        <Lines block={plan.name} u={u} font={FONT_STACK.display} color={PALETTE.ink} weight={700} />
        <Gap h={plan.spacer} u={u} />
        <CodeRow plan={plan} u={u} color={PALETTE.ink} rule={false} />
      </>
    );
  } else if (plan.tier === "compact") {
    const codeW = textWidth(plan.code.text, CODE_FONT, plan.code.size, plan.code.size * 0.04) * 1.1;
    body = (
      <>
        <Gap h={plan.spacer} u={u} />
        <Column style={{ gap: 0.8 * u }}>
          <Lines block={plan.name} u={u} font={FONT_STACK.display} color={PALETTE.ink} weight={700} />
          {plan.variety ? <Lines block={plan.variety} u={u} font={FONT_STACK.display} color={PALETTE.inkSoft} weight={400} italic /> : null}
        </Column>
        <Gap h={plan.spacer} u={u} />
        <Row stackOnMobile={false} style={{ alignItems: "center", gap: 1.2 * u }}>
          <Column style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONT_STACK.body, fontWeight: 700, fontSize: 2.9 * u, lineHeight: 1.2, color: accent }}>
              <Span style={{ fontSize: plan.captionSize * u, letterSpacing: CAPTION_TRACKING * plan.captionSize * u, color: PALETTE.inkSoft }}>BEST BEFORE </Span>
              {plan.bestBefore}
            </Text>
          </Column>
          <Column style={{ width: codeW * u, flex: "none" }}>
            <Text style={{ fontFamily: FONT_STACK.mono, fontWeight: 500, fontSize: plan.code.size * u, lineHeight: 1.2, letterSpacing: plan.code.size * 0.04 * u, color: PALETTE.inkSoft, textAlign: "right" }}>
              {plan.code.text}
            </Text>
          </Column>
        </Row>
      </>
    );
  } else if (plan.tier === "standard") {
    body = (
      <>
        <CodeRow plan={plan} u={u} color={accent} rule />
        <Gap h={plan.spacer} u={u} />
        <Column style={{ gap: NAME_VARIETY_GAP * u }}>
          <Lines block={plan.name} u={u} font={FONT_STACK.display} color={PALETTE.ink} weight={700} />
          {plan.variety ? <Lines block={plan.variety} u={u} font={FONT_STACK.display} color={PALETTE.inkSoft} weight={400} italic /> : null}
        </Column>
        <Gap h={plan.spacer} u={u} />
        <Column style={{ gap: 0 }}>
          {plan.allergens ? <Lines block={plan.allergens} u={u} font={FONT_STACK.body} color={accent} weight={700} /> : null}
          {plan.allergens ? <Gap h={ALLERGEN_GAP} u={u} /> : null}
          <Column style={{ height: DIVIDER * u, backgroundColor: PALETTE.rule }} />
          <Gap h={DIVIDER_GAP} u={u} />
          <Row stackOnMobile={false} style={{ gap: 1.5 * u }}>
            <DateBlock label="MADE" value={plan.made} size={3.0} caption={plan.captionSize} u={u} color={PALETTE.ink} inRow />
            <DateBlock label="BEST BEFORE" value={plan.bestBefore} size={3.0} caption={plan.captionSize} u={u} color={accent} align="right" inRow />
          </Row>
        </Column>
      </>
    );
  } else {
    const k = plan.scale;
    body = (
      <Row stackOnMobile={false} style={{ gap: plan.gutter * u, alignItems: "stretch" }}>
        <Column style={{ flex: 1, height: plan.contentHeight * u }}>
          <CodeRow plan={plan} u={u} color={accent} rule />
          <Gap h={plan.spacer} u={u} />
          <Column style={{ gap: NAME_VARIETY_GAP * k * u }}>
            <Lines block={plan.name} u={u} font={FONT_STACK.display} color={PALETTE.ink} weight={700} />
            {plan.variety ? <Lines block={plan.variety} u={u} font={FONT_STACK.display} color={PALETTE.inkSoft} weight={400} italic /> : null}
          </Column>
          <Gap h={plan.spacer} u={u} />
          {plan.allergens ? <Lines block={plan.allergens} u={u} font={FONT_STACK.body} color={accent} weight={700} /> : null}
        </Column>
        <Column
          style={{
            width: plan.asideWidth * u,
            flex: "none",
            height: plan.contentHeight * u,
            backgroundColor: tint,
            borderRadius: 1.2 * u,
            padding: 1.5 * k * u,
            justifyContent: "center",
            gap: 2.2 * k * u,
          }}
        >
          <DateBlock label="MADE" value={plan.made} size={plan.asideDateSize} caption={plan.captionSize} u={u} color={PALETTE.ink} />
          <Column style={{ height: 0.2 * u, backgroundColor: accent }} />
          <DateBlock label="BEST BEFORE" value={plan.bestBefore} size={plan.asideDateSize} caption={plan.captionSize} u={u} color={accent} />
        </Column>
      </Row>
    );
  }

  return (
    <Column
      style={{
        width: outerW,
        height: plan.height * u,
        padding: SAFE_INSET * u,
        backgroundColor: paper ? PALETTE.paper : undefined,
        borderRadius: sheet.cornerRadius * u,
        overflow: "hidden",
      }}
    >
      <Column
        style={{
          width: outerW - 2 * SAFE_INSET * u,
          height: (plan.height - 2 * SAFE_INSET) * u,
          border: `${RULE_WIDTH * u}px solid ${accent}`,
          borderRadius: frameRadius * u,
          padding: plan.pad * u,
          overflow: "hidden",
        }}
      >
        {body}
      </Column>
    </Column>
  );
}

/** An empty slot (a label position that is skipped or unused): same footprint, nothing drawn. */
export function EmptySlot({ sheet, u, widthPx }: { sheet: Pick<Sheet, "labelWidth" | "labelHeight">; u: number; widthPx?: number }) {
  return <Column style={{ width: widthPx ?? sheet.labelWidth * u, height: sheet.labelHeight * u }} />;
}

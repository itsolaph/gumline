import { Column, Divider, Grid, Heading, LineBreak, Page, Row, Section, Span, Table, TableCell, TableRow, Text } from "@hyper-elements/react";
import { formatLong } from "../dates";
import { daysLeftText, type InventoryRow, USE_SOON_DAYS } from "../inventory";
import { FONT_STACK, PALETTE, accentFor, gumlineTheme } from "../theme";

export interface WebFont {
  family: string;
  src: string;
  format: "woff2";
  weight: number;
  style?: "normal" | "italic";
}

export interface PantryPageProps {
  rows: InventoryRow[];
  referenceDate: string;
  fonts: WebFont[];
  labelsHref: string[];
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Column style={{ backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.rule}`, borderRadius: 6, padding: [14, 16], gap: 2 }}>
      <Text style={{ apply: ["eyebrow"] }}>{label}</Text>
      <Text style={{ fontFamily: FONT_STACK.display, fontWeight: 700, fontSize: 30, lineHeight: 1.1, color: PALETTE.ink }}>{value}</Text>
      {note ? <Text style={{ fontSize: 12.5, color: PALETTE.muted }}>{note}</Text> : null}
    </Column>
  );
}

function Swatch() {
  return <Column style={{ width: 14, height: 14, flex: "none", backgroundColor: "#F2C777" }} />;
}

export function PantryPage({ rows, referenceDate, fonts, labelsHref }: PantryPageProps) {
  const jars = rows.reduce((n, r) => n + r.jar.quantity, 0);
  const soon = rows.filter((r) => r.status === "soon" || r.status === "past");
  const soonJars = soon.reduce((n, r) => n + r.jar.quantity, 0);
  const first = rows[0];

  return (
    <Page
      width={980}
      theme={gumlineTheme}
      fonts={fonts}
      title="Gumline pantry shelf"
      description="Every jar in the pantry, soonest best-before first."
      lang="en"
      style={{ backgroundColor: PALETTE.paper, color: PALETTE.ink }}
    >
      <Section style={{ padding: [48, 36, 28], gap: 10 }}>
        <Text style={{ apply: ["eyebrow"], color: accentFor("chili").accent }}>GUMLINE · PANTRY SHELF · AS OF {formatLong(referenceDate).toUpperCase()}</Text>
        <Heading level={1} style={{ fontSize: 52, lineHeight: 1.02 }}>
          What to eat first
        </Heading>
        <Text style={{ fontSize: 17, color: PALETTE.inkSoft, maxWidth: 620 }}>
          {jars} jars across {rows.length} batches, sorted by best-before date. Anything within {USE_SOON_DAYS} days is marked
          for the next few weeks of cooking.
        </Text>
      </Section>

      <Section style={{ padding: [6, 36, 20], gap: 14 }}>
        <Grid columns={3} style={{ gap: 14 }}>
          <Stat label="Jars on the shelf" value={String(jars)} note={`${rows.length} batches`} />
          <Stat
            label="Use soon"
            value={`${soonJars} ${soonJars === 1 ? "jar" : "jars"}`}
            note={`${soon.length} ${soon.length === 1 ? "batch" : "batches"} · within ${USE_SOON_DAYS} days`}
          />
          <Stat
            label="First to go"
            value={first ? formatLong(first.jar.bestBefore) : "none"}
            note={first ? first.jar.name : undefined}
          />
        </Grid>
      </Section>

      <Section style={{ padding: [8, 36, 44], gap: 18 }}>
        <Column style={{ apply: ["panel"], padding: [18, 20] }}>
          <Table style={{ fontSize: 14, cellPadding: [11, 12], rowBorder: { width: 1, style: "solid", color: PALETTE.rule } }}>
            <TableRow header style={{ backgroundColor: PALETTE.paperDeep }}>
              <TableCell>Jar</TableCell>
              <TableCell style={{ width: 140 }}>Batch code</TableCell>
              <TableCell style={{ width: 118 }}>Made</TableCell>
              <TableCell style={{ width: 125 }}>Best before</TableCell>
              <TableCell style={{ width: 150 }}>Time left</TableCell>
              <TableCell style={{ width: 58, textAlign: "right" }}>Jars</TableCell>
            </TableRow>
            {rows.map((r) => {
              const a = accentFor(r.jar.accent);
              const highlight = r.status === "soon" ? PALETTE.soon : r.status === "past" ? "#F6D3CB" : undefined;
              return (
                <TableRow key={r.jar.batchCode} style={{ backgroundColor: highlight }}>
                  <TableCell>
                    <Span style={{ fontFamily: FONT_STACK.display, fontWeight: 700, fontSize: 16, color: PALETTE.ink }}>{r.jar.name}</Span>
                    <LineBreak />
                    <Span style={{ fontSize: 12.5, color: PALETTE.muted }}>{r.jar.variety}</Span>
                  </TableCell>
                  <TableCell style={{ fontFamily: FONT_STACK.mono, fontSize: 13, color: a.accent, fontWeight: 600 }}>{r.jar.batchCode}</TableCell>
                  <TableCell>{formatLong(r.jar.batchDate)}</TableCell>
                  <TableCell style={{ fontWeight: 700, color: r.status === "ok" ? PALETTE.ink : PALETTE.soonInk }}>{formatLong(r.jar.bestBefore)}</TableCell>
                  <TableCell style={{ fontWeight: 700, color: r.status === "ok" ? PALETTE.muted : PALETTE.soonInk }}>
                    {r.status === "past" ? "Past date" : daysLeftText(r)}
                    {r.status === "soon" ? " · use soon" : ""}
                  </TableCell>
                  <TableCell style={{ textAlign: "right", fontWeight: 600 }}>{r.jar.quantity}</TableCell>
                </TableRow>
              );
            })}
          </Table>
        </Column>

        <Divider style={{ borderTop: `1px solid ${PALETTE.rule}` }} />
        <Row stackOnMobile={false} style={{ gap: 10, alignItems: "center" }}>
          <Swatch />
          <Text style={{ fontSize: 13, color: PALETTE.muted }}>
            Highlighted rows are within {USE_SOON_DAYS} days of their best-before date, counted from {formatLong(referenceDate)}.
          </Text>
        </Row>
        <Text style={{ fontSize: 13, color: PALETTE.muted }}>Print sheets: {labelsHref.join(" · ")}</Text>
      </Section>
    </Page>
  );
}

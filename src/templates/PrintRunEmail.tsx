import { Button, Column, Divider, Email, Heading, List, ListItem, Row, Section, Table, TableCell, TableRow, Text } from "@hyper-elements/react";
import { FONT_STACK, PALETTE, accentFor, gumlineTheme } from "../theme";

export interface RunSummary {
  sheetId: string;
  brand: string;
  pageSize: string;
  pdf: string;
  alignPdf: string;
  perSheet: number;
  start: number;
  labels: number;
  pages: number;
  blanksOnLast: number;
  nextStart: number;
}

export interface PrintRunEmailProps {
  runs: RunSummary[];
  products: number;
  labels: number;
  nudge: { x: number; y: number };
  accentKeys: string[];
}

const mm = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

function nextStartText(r: RunSummary): string {
  return r.blanksOnLast === 0
    ? "Last sheet is full. Start a fresh sheet at 1."
    : `Reuse the last sheet from position ${r.nextStart} (--start ${r.nextStart}).`;
}

export function PrintRunEmail({ runs, products, labels, nudge, accentKeys }: PrintRunEmailProps) {
  const nudged = nudge.x !== 0 || nudge.y !== 0;
  return (
    <Email
      width={600}
      theme={gumlineTheme}
      title="Your Gumline print run is ready"
      previewText={`${labels} labels for ${products} batches, laid out for ${runs.map((r) => r.sheetId).join(", ")}.`}
      lang="en"
      style={{ gap: 16 }}
    >
      <Section style={{ padding: [24, 0], gap: 16 }}>
        <Column style={{ backgroundColor: PALETTE.ink, color: PALETTE.paper, padding: 28, borderRadius: 8, gap: 12 }}>
          <Text style={{ fontFamily: FONT_STACK.mono, fontSize: 11, fontWeight: 600, letterSpacing: 1.4, color: "#E9B872" }}>
            GUMLINE · PRINT RUN
          </Text>
          <Heading level={1} style={{ fontSize: 30, color: PALETTE.paper, mobile: { fontSize: 25 } }}>
            Your labels are ready to print
          </Heading>
          <Text style={{ fontSize: 15, color: "#E7DCC2", lineHeight: 1.55 }}>
            {labels} labels from {products} batches are laid out for {runs.length === 1 ? "one sheet type" : `${runs.length} sheet types`}. Print the
            alignment page on plain paper first, hold it against a label sheet to the light, and adjust the nudge until the outlines sit on the die cuts.
          </Text>
          <Row stackOnMobile style={{ gap: 12, padding: [4, 0, 0] }}>
            <Button href={`./${runs[0]?.pdf ?? ""}`} style={{ backgroundColor: "#C2412B", color: "#FFFFFF" }}>
              Open {runs[0]?.sheetId} sheet PDF
            </Button>
          </Row>
        </Column>

        <Column style={{ apply: ["panel"] }}>
          <Text style={{ apply: ["eyebrow"] }}>Sheets used</Text>
          <Heading level={2}>What goes on which paper</Heading>
          <Table style={{ fontSize: 14, cellPadding: [9, 8], rowBorder: { width: 1, style: "solid", color: PALETTE.rule } }}>
            <TableRow header style={{ backgroundColor: PALETTE.paperDeep }}>
              <TableCell style={{ width: 110 }}>Sheet</TableCell>
              <TableCell style={{ width: 70 }}>Sheets</TableCell>
              <TableCell style={{ width: 100 }}>Labels / sheet</TableCell>
              <TableCell style={{ width: 80 }}>Blanks left</TableCell>
              <TableCell>Next time</TableCell>
            </TableRow>
            {runs.map((r) => (
              <TableRow key={r.sheetId}>
                <TableCell style={{ fontWeight: 700 }}>
                  {r.brand} {r.sheetId}
                </TableCell>
                <TableCell>{r.pages}</TableCell>
                <TableCell>
                  {r.perSheet} ({r.pageSize})
                </TableCell>
                <TableCell>{r.blanksOnLast}</TableCell>
                <TableCell>{r.blanksOnLast === 0 ? "Fresh sheet" : `Start at position ${r.nextStart}`}</TableCell>
              </TableRow>
            ))}
          </Table>
        </Column>

        <Column style={{ apply: ["panel"] }}>
          <Text style={{ apply: ["eyebrow"] }}>Half-used sheets</Text>
          <Heading level={2}>Where to pick up next time</Heading>
          <List type="bullet" style={{ fontSize: 14, gap: 8 }}>
            {runs.map((r) => (
              <ListItem key={`next-${r.sheetId}`}>
                {r.brand} {r.sheetId}: this run started at position {r.start} and used {r.labels} of {r.pages * r.perSheet} positions
                across {r.pages} {r.pages === 1 ? "sheet" : "sheets"}. {nextStartText(r)}
              </ListItem>
            ))}
          </List>
          <Divider style={{ borderTop: `1px solid ${PALETTE.rule}` }} />
          <Text style={{ fontSize: 14, color: PALETTE.inkSoft }}>
            Printer nudge in this run: {nudged ? `x ${mm(nudge.x)} mm, y ${mm(nudge.y)} mm` : "none (0, 0)"}. Pass --nudge-x and --nudge-y to shift
            every label for a printer that feeds off-centre.
          </Text>
        </Column>

        <Column style={{ apply: ["panel"] }}>
          <Text style={{ apply: ["eyebrow"] }}>Files</Text>
          <Heading level={2}>In this run</Heading>
          <List type="bullet" style={{ fontSize: 14, gap: 6 }}>
            {runs.map((r) => (
              <ListItem key={`file-${r.sheetId}`}>
                {r.pdf} and {r.alignPdf}
              </ListItem>
            ))}
            <ListItem>labels/*.png, one image per batch, for sharing or a shop listing</ListItem>
            <ListItem>pantry.html, every jar sorted by best-before</ListItem>
          </List>
          <Row stackOnMobile={false} style={{ gap: 6, padding: [4, 0, 0] }}>
            {accentKeys.map((k) => (
              <Column key={k} style={{ width: 18, height: 18, flex: "none", backgroundColor: accentFor(k).accent, borderRadius: 9 }} />
            ))}
          </Row>
        </Column>

        <Column style={{ padding: [6, 16, 12], gap: 6, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: PALETTE.muted, textAlign: "center" }}>
            Made with Gumline. Label sheet names are trademarks of their owners; this project is not affiliated.
          </Text>
        </Column>
      </Section>
    </Email>
  );
}

import { Column, Document, Row } from "@hyper-elements/react";
import { EmptySlot, Label } from "../components/Label";
import { PX_PER_MM, labelRect, mmToPx, snapColumns, type Pagination } from "../geometry";
import { gumlineTheme } from "../theme";
import type { Jar, Nudge, Sheet } from "../types";

export interface SheetDocumentProps {
  sheet: Sheet;
  labels: Jar[];
  pagination: Pagination;
  nudge: Nudge;
  /** Print the warm paper tint under each label. Off by default: it floods ink and shows any misfeed. */
  tint: boolean;
}

/**
 * Print-ready label sheet. The page has no margin; a padded wrapper puts the first label at the
 * sheet's top/left margin (plus the printer nudge) and each Row steps by the label pitch.
 */
export function SheetDocument({ sheet, labels, pagination, nudge, tint }: SheetDocumentProps) {
  const u = PX_PER_MM;
  const origin = labelRect(sheet, 0, 0, nudge);
  const { widthPx, gapPx: gapX } = snapColumns(sheet);
  const gapY = mmToPx(sheet.pitchY - sheet.labelHeight);

  return (
    <Document
      size={sheet.page}
      orientation="portrait"
      margin={0}
      theme={gumlineTheme}
      title={`Gumline labels ${sheet.id} (${sheet.page})`}
      lang="en"
      style={{ backgroundColor: "#FFFFFF" }}
    >
      {pagination.pages.map((page, p) => (
        <Document.Page key={`page-${p}`} style={{ backgroundColor: "#FFFFFF", gap: 0 }}>
          <Column style={{ padding: [mmToPx(origin.y), 0, 0, mmToPx(origin.x)], gap: gapY }}>
            {Array.from({ length: sheet.rows }, (_, row) => (
              <Row key={`row-${row}`} stackOnMobile={false} style={{ gap: gapX, alignItems: "start" }}>
                {Array.from({ length: sheet.columns }, (_, col) => {
                  const index = page.slots[row * sheet.columns + col];
                  return (
                    <Column key={`slot-${row}-${col}`} style={{ width: widthPx, flex: "none" }}>
                      {index === null || index === undefined ? (
                        <EmptySlot sheet={sheet} u={u} widthPx={widthPx} />
                      ) : (
                        <Label jar={labels[index]} sheet={sheet} u={u} paper={tint} widthPx={widthPx} />
                      )}
                    </Column>
                  );
                })}
              </Row>
            ))}
          </Column>
        </Document.Page>
      ))}
    </Document>
  );
}

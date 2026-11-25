import { defineTheme } from "@hyper-elements/react";
import type { AccentKey } from "./data";

export const PALETTE = {
  paper: "#F8F0DD",
  paperDeep: "#EFE3C6",
  card: "#FFFBF0",
  ink: "#2B2118",
  inkSoft: "#5C4E3E",
  muted: "#665843",
  rule: "#D8C9A8",
  white: "#FFFFFF",
  soon: "#FBE3B4",
  soonInk: "#7A3F00",
} as const;

export interface AccentStyle {
  /** Strong colour for bands, dates and rules. Dark enough for small print. */
  accent: string;
  /** Pale wash for panels. */
  tint: string;
  label: string;
}

export const ACCENTS: Record<AccentKey, AccentStyle> = {
  plum: { accent: "#6B2E5A", tint: "#EEDDE8", label: "Plum" },
  apricot: { accent: "#B85A12", tint: "#F8E0C6", label: "Apricot" },
  pickle: { accent: "#44692F", tint: "#DDEAD0", label: "Pickle green" },
  gold: { accent: "#8F6A06", tint: "#F4E6B8", label: "Gold" },
  chili: { accent: "#A82A18", tint: "#F6D8D0", label: "Chilli red" },
  stock: { accent: "#6E4D29", tint: "#E9DAC4", label: "Stock brown" },
  berry: { accent: "#8A2440", tint: "#F3D8DE", label: "Berry" },
  slate: { accent: "#38566A", tint: "#D9E4EB", label: "Slate" },
};

export function accentFor(key: string): AccentStyle {
  return ACCENTS[key as AccentKey] ?? ACCENTS.slate;
}

export const FONT_STACK = {
  display: "Fraunces, Georgia, 'Times New Roman', serif",
  body: "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  mono: "'IBM Plex Mono', Menlo, Consolas, monospace",
} as const;

/** One theme for every output (PDF, PNG, web page, email). */
export const gumlineTheme = defineTheme({
  colors: {
    background: PALETTE.paper,
    foreground: PALETTE.ink,
    primary: ACCENTS.chili.accent,
    primaryForeground: "#FFFFFF",
    secondary: ACCENTS.pickle.accent,
    muted: PALETTE.muted,
    border: PALETTE.rule,
    surface: PALETTE.card,
  },
  fonts: {
    heading: FONT_STACK.display,
    body: FONT_STACK.body,
  },
  fontSizes: { body: 15 },
  lineHeights: { body: 1.5 },
  elements: {
    Heading: {
      fontFamily: FONT_STACK.display,
      fontWeight: 700,
      color: "{colors.foreground}",
      by: {
        level: {
          1: { fontSize: 38, lineHeight: 1.08, letterSpacing: -0.6, mobile: { fontSize: 30 } },
          2: { fontSize: 24, lineHeight: 1.15, letterSpacing: -0.2, mobile: { fontSize: 20 } },
          3: { fontSize: 17, lineHeight: 1.25 },
        },
      },
    },
    Button: {
      backgroundColor: "{colors.primary}",
      color: "{colors.primaryForeground}",
      fontFamily: FONT_STACK.body,
      fontSize: 14,
      fontWeight: 700,
      padding: [12, 22],
      borderRadius: 4,
    },
  },
  styles: {
    panel: {
      backgroundColor: PALETTE.card,
      border: `1px solid ${PALETTE.rule}`,
      borderRadius: 6,
      padding: 22,
      gap: 12,
    },
    eyebrow: {
      fontFamily: FONT_STACK.mono,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: PALETTE.muted,
    },
  },
  formats: {
    email: {
      colors: { background: PALETTE.paperDeep },
    },
  },
});

declare module "@hyper-elements/react" {
  interface Register {
    theme: typeof gumlineTheme;
  }
}

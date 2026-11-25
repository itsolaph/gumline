import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { addMonths, parseIso, yearMonthCode } from "./dates";
import type { Jar, Product } from "./types";

export const DEFAULT_CSV = fileURLToPath(new URL("../data/pantry.csv", import.meta.url));

export const ACCENT_KEYS = ["plum", "apricot", "pickle", "gold", "chili", "stock", "berry", "slate"] as const;
export type AccentKey = (typeof ACCENT_KEYS)[number];

/** RFC 4180-style CSV: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

const REQUIRED = ["name", "batch_date", "shelf_life_months", "quantity"] as const;

export function parseProducts(csv: string): Product[] {
  const [header, ...body] = parseCsv(csv);
  if (!header) throw new Error("CSV is empty.");
  const cols = header.map((h) => h.trim().toLowerCase());
  for (const need of REQUIRED) {
    if (!cols.includes(need)) throw new Error(`CSV is missing the "${need}" column.`);
  }
  const at = (row: string[], name: string): string => (row[cols.indexOf(name)] ?? "").trim();

  return body.map((row, i): Product => {
    const line = i + 2;
    const name = at(row, "name");
    if (!name) throw new Error(`CSV line ${line}: name is empty.`);
    const batchDate = at(row, "batch_date");
    try {
      parseIso(batchDate);
    } catch (e) {
      throw new Error(`CSV line ${line}: ${(e as Error).message}`);
    }
    const shelf = Number(at(row, "shelf_life_months"));
    const qty = Number(at(row, "quantity"));
    if (!Number.isInteger(shelf) || shelf < 0) throw new Error(`CSV line ${line}: shelf_life_months must be a whole number.`);
    if (!Number.isInteger(qty) || qty < 0) throw new Error(`CSV line ${line}: quantity must be a whole number.`);
    const accent = at(row, "accent") || "slate";
    if (!(ACCENT_KEYS as readonly string[]).includes(accent)) {
      throw new Error(`CSV line ${line}: unknown accent "${accent}". Use one of: ${ACCENT_KEYS.join(", ")}.`);
    }
    const code = (at(row, "code") || name.replace(/[^A-Za-z]/g, "").slice(0, 3)).toUpperCase();
    return {
      name,
      variety: at(row, "variety"),
      batchDate,
      shelfLifeMonths: shelf,
      quantity: qty,
      allergens: at(row, "allergens")
        .split(/[;|]/)
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean),
      accent,
      code,
    };
  });
}

/**
 * Adds best-before and a batch code like JAM-2611-03 (code, batch year+month, nth batch of that
 * code in that month, in CSV order).
 */
export function deriveJars(products: Product[]): Jar[] {
  // Number batches within the same code and month by batch date, earliest first (CSV order breaks ties).
  const order = new Map<number, number>();
  const groups = new Map<string, number[]>();
  products.forEach((p, i) => {
    const key = `${p.code}-${yearMonthCode(p.batchDate)}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  for (const idx of groups.values()) {
    [...idx]
      .sort((a, b) => products[a].batchDate.localeCompare(products[b].batchDate) || a - b)
      .forEach((i, rank) => order.set(i, rank + 1));
  }
  return products.map((p, i) => {
    const key = `${p.code}-${yearMonthCode(p.batchDate)}`;
    const n = order.get(i)!;
    return {
      ...p,
      bestBefore: addMonths(p.batchDate, p.shelfLifeMonths),
      batchCode: `${key}-${String(n).padStart(2, "0")}`,
    };
  });
}

export function loadJars(path: string = DEFAULT_CSV): Jar[] {
  return deriveJars(parseProducts(readFileSync(path, "utf8")));
}

/** One entry per label to print: each jar repeated `quantity` times, in CSV order. */
export function expandLabels(jars: Jar[]): Jar[] {
  return jars.flatMap((j) => Array.from({ length: j.quantity }, () => j));
}

/** Default reference date for "use soon": the latest batch date, so output never depends on today's date. */
export function latestBatchDate(jars: Jar[]): string {
  return jars.map((j) => j.batchDate).reduce((a, b) => (a > b ? a : b));
}

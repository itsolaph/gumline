import { daysBetween } from "./dates";
import type { Jar } from "./types";

export type Status = "past" | "soon" | "ok";

export interface InventoryRow {
  jar: Jar;
  daysLeft: number;
  status: Status;
}

/** Items within this many days of their best-before date are highlighted as "use soon". */
export const USE_SOON_DAYS = 30;

/** Every jar, soonest best-before first (ties by name, so output is deterministic). */
export function buildInventory(jars: Jar[], referenceDate: string): InventoryRow[] {
  return jars
    .map((jar) => {
      const daysLeft = daysBetween(referenceDate, jar.bestBefore);
      const status: Status = daysLeft < 0 ? "past" : daysLeft <= USE_SOON_DAYS ? "soon" : "ok";
      return { jar, daysLeft, status };
    })
    .sort((a, b) => a.jar.bestBefore.localeCompare(b.jar.bestBefore) || a.jar.batchCode.localeCompare(b.jar.batchCode));
}

export function daysLeftText(row: InventoryRow): string {
  if (row.daysLeft < 0) return `${-row.daysLeft} d past`;
  if (row.daysLeft === 0) return "today";
  if (row.daysLeft < 60) return `${row.daysLeft} d`;
  return `${Math.round(row.daysLeft / 30.4)} mo`;
}

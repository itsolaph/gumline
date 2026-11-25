/**
 * Calendar math on integer Y/M/D so results never depend on the machine's time zone.
 * All dates travel as ISO "yyyy-mm-dd" strings.
 */

export interface Ymd {
  y: number;
  m: number; // 1-12
  d: number;
}

export function parseIso(iso: string): Ymd {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) throw new Error(`Invalid date "${iso}". Expected yyyy-mm-dd.`);
  const ymd = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  if (ymd.m < 1 || ymd.m > 12 || ymd.d < 1 || ymd.d > daysInMonth(ymd.y, ymd.m)) {
    throw new Error(`Invalid date "${iso}": no such day.`);
  }
  return ymd;
}

export function formatIso({ y, m, d }: Ymd): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** Add whole calendar months; the day is clamped to the end of the target month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parseIso(iso);
  const index = y * 12 + (m - 1) + months;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return formatIso({ y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) });
}

/** Days since 1970-01-01 in the proleptic Gregorian calendar (civil-from-days algorithm). */
export function toDayNumber(iso: string): number {
  const { y, m, d } = parseIso(iso);
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "22 Nov 2026" */
export function formatLong(iso: string): string {
  const { y, m, d } = parseIso(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Nov 2026" */
export function formatMonthYear(iso: string): string {
  const { y, m } = parseIso(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "22 Nov 26" */
export function formatShort(iso: string): string {
  const { y, m, d } = parseIso(iso);
  return `${d} ${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

/** "2611" for November 2026, used in batch codes. */
export function yearMonthCode(iso: string): string {
  const { y, m } = parseIso(iso);
  return `${String(y).slice(2)}${String(m).padStart(2, "0")}`;
}

import { inflateSync } from "node:zlib";
import type { Rect } from "./types";

const PT_PER_MM = 72 / 25.4;

export interface FilledRect extends Rect {
  /** "r g b" as written by the PDF, e.g. "0.8 0.2 0.2". */
  color: string;
}

export interface MeasuredPage {
  /** Bounding boxes of filled shapes (rectangles and rounded rectangles), in mm from the page's top-left, in paint order. */
  rects: FilledRect[];
  /** Bounding boxes of stroked paths (outlines, ruler ticks, crosshairs), same units. */
  strokes: Rect[];
}

type Matrix = [number, number, number, number, number, number];

function multiply(a: Matrix, b: Matrix): Matrix {
  // new CTM = cm x CTM
  return [
    b[0] * a[0] + b[1] * a[2],
    b[0] * a[1] + b[1] * a[3],
    b[2] * a[0] + b[3] * a[2],
    b[2] * a[1] + b[3] * a[3],
    b[4] * a[0] + b[5] * a[2] + a[4],
    b[4] * a[1] + b[5] * a[3] + a[5],
  ];
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Inflate every page content stream (the ones pdfkit opens with its y-flip). */
export function pageStreams(pdf: Uint8Array): string[] {
  const buf = Buffer.from(pdf);
  const text = buf.toString("latin1");
  const streams: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length;
    const end = text.indexOf("endstream", start);
    try {
      const out = inflateSync(buf.subarray(start, end)).toString("latin1");
      if (out.startsWith("1 0 0 -1 0 ")) streams.push(out);
    } catch {
      /* not a flate stream */
    }
  }
  return streams;
}

export function countPages(pdf: Uint8Array): number {
  const text = Buffer.from(pdf).toString("latin1");
  return (text.match(/\/Type \/Page(?![a-zA-Z])/g) ?? []).length;
}

/** Page height in pt, from the y-flip that opens each content stream. */
function flipHeight(stream: string): number {
  return Number(/^1 0 0 -1 0 ([\d.]+) cm/.exec(stream)?.[1] ?? 0);
}

export function measurePage(stream: string): MeasuredPage {
  const height = flipHeight(stream);
  const tokens = stream.split(/\s+/).filter(Boolean);
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const operands: string[] = [];
  let color = "0 0 0";
  let points: Array<[number, number]> = [];
  const rects: FilledRect[] = [];

  const strokes: Rect[] = [];
  const addPoint = (x: number, y: number): void => {
    points.push(apply(ctm, x, y));
  };
  const bbox = (): Rect => {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return {
      x: Math.min(...xs) / PT_PER_MM,
      y: (height - Math.max(...ys)) / PT_PER_MM,
      width: (Math.max(...xs) - Math.min(...xs)) / PT_PER_MM,
      height: (Math.max(...ys) - Math.min(...ys)) / PT_PER_MM,
    };
  };

  for (const token of tokens) {
    if (/^[-+]?[\d.]+$/.test(token) || token.startsWith("/") || token.startsWith("<") || token.startsWith("[")) {
      operands.push(token);
      continue;
    }
    const nums = operands.map(Number);
    switch (token) {
      case "q":
        stack.push(ctm);
        break;
      case "Q":
        ctm = stack.pop() ?? ctm;
        break;
      case "cm":
        if (nums.length >= 6) ctm = multiply(ctm, nums.slice(-6) as Matrix);
        break;
      case "scn":
      case "sc":
        if (nums.length === 3) color = nums.join(" ");
        break;
      case "m":
      case "l":
        if (nums.length >= 2) addPoint(nums[nums.length - 2], nums[nums.length - 1]);
        break;
      case "c":
        if (nums.length >= 6) {
          const n = nums.slice(-6);
          addPoint(n[0], n[1]);
          addPoint(n[2], n[3]);
          addPoint(n[4], n[5]);
        }
        break;
      case "re":
        if (nums.length >= 4) {
          const [x, y, w, h] = nums.slice(-4);
          addPoint(x, y);
          addPoint(x + w, y + h);
        }
        break;
      case "f":
      case "F":
      case "f*":
        if (points.length > 1) rects.push({ ...bbox(), color });
        points = [];
        break;
      case "S":
      case "s":
        if (points.length > 1) strokes.push(bbox());
        points = [];
        break;
      case "n":
      case "B":
      case "b":
        points = [];
        break;
      default:
        break;
    }
    operands.length = 0;
  }
  return { rects, strokes };
}

export function measurePdf(pdf: Uint8Array): MeasuredPage[] {
  return pageStreams(pdf).map(measurePage);
}

/** "#RRGGBB" to the "r g b" form PDFs use, to three decimals' tolerance when comparing. */
export function hexToPdfColor(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function colorMatches(pdfColor: string, hex: string): boolean {
  const want = hexToPdfColor(hex);
  const got = pdfColor.split(" ").map(Number);
  return got.length === 3 && got.every((g, i) => Math.abs(g - want[i]) < 0.01);
}

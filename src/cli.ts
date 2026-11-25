import { resolve } from "node:path";
import { DEFAULT_CSV } from "./data";
import { parseIso } from "./dates";
import type { Nudge } from "./types";

export interface CliOptions {
  sheets: string[]; // empty = every sheet in the registry
  start: number;
  nudge: Nudge;
  csv: string;
  referenceDate: string | null; // null = latest batch date
  outDir: string;
  pngSheet: string | null;
  tint: boolean;
}

export const USAGE = `Usage: npm run build -- [options]

  --sheet <id[,id]>     Sheet(s) from data/sheets.json (default: all). Repeatable.
  --start <n>           First label position to use, 1-based, row by row (default 1).
  --nudge-x <mm>        Shift every label right (negative: left) for off-centre printers.
  --nudge-y <mm>        Shift every label down (negative: up).
  --csv <file>          Label data (default data/pantry.csv).
  --today <yyyy-mm-dd>  Reference date for "use soon" (default: latest batch date).
  --png-sheet <id>      Sheet whose label size the PNGs use (default L7163, else the first sheet).
  --tint                Print the warm paper tint on the sheets too (uses more ink).
  --out <dir>           Output folder (default ./out).
  --help                Show this text.`;

function num(flag: string, value: string | undefined): number {
  const n = Number(value);
  if (value === undefined || value === "" || !Number.isFinite(n)) throw new Error(`${flag} needs a number (got "${value ?? ""}").`);
  return n;
}

export function parseArgs(argv: string[], cwd: string = process.cwd()): CliOptions & { help: boolean } {
  const opts: CliOptions & { help: boolean } = {
    sheets: [],
    start: 1,
    nudge: { x: 0, y: 0 },
    csv: DEFAULT_CSV,
    referenceDate: null,
    outDir: resolve(cwd, "out"),
    pngSheet: null,
    tint: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const take = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${flag} needs a value.`);
      return v;
    };
    switch (flag) {
      case "--sheet":
        opts.sheets.push(...take().split(",").map((s) => s.trim()).filter(Boolean));
        break;
      case "--start": {
        const n = num(flag, take());
        if (!Number.isInteger(n) || n < 1) throw new Error("--start must be a whole number, 1 or more.");
        opts.start = n;
        break;
      }
      case "--nudge-x":
        opts.nudge.x = num(flag, take());
        break;
      case "--nudge-y":
        opts.nudge.y = num(flag, take());
        break;
      case "--csv":
        opts.csv = resolve(cwd, take());
        break;
      case "--today":
      case "--reference-date": {
        const v = take();
        parseIso(v);
        opts.referenceDate = v;
        break;
      }
      case "--png-sheet":
        opts.pngSheet = take();
        break;
      case "--tint":
        opts.tint = true;
        break;
      case "--out":
        opts.outDir = resolve(cwd, take());
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
      default:
        throw new Error(`Unknown option "${flag}".\n\n${USAGE}`);
    }
  }
  return opts;
}

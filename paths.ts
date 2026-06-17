import { basename, dirname, fromFileUrl, isAbsolute, join } from "@std/path";

/**
 * Returns the directory the program should anchor relative paths to. For a
 * compiled executable this is the folder the `.exe` lives in; when running via
 * the `deno` CLI (dev) it is the folder this source file lives in.
 */
export function baseDir(): string {
  const exe = Deno.execPath();
  const exeName = basename(exe).toLowerCase();
  if (exeName === "deno" || exeName === "deno.exe") {
    return dirname(fromFileUrl(import.meta.url));
  }
  return dirname(exe);
}

/**
 * Resolves a directory from an env var, falling back to `fallback`. Relative
 * paths are anchored to the executable's directory (not the current working
 * directory), so the folders always sit next to the running program. Absolute
 * paths are honored as-is.
 */
export function resolveDir(key: string, fallback: string): string {
  const value = Deno.env.get(key)?.trim();
  const dir = (value && value.length > 0 ? value : fallback).replace(
    /[/\\]+$/,
    "",
  );
  if (isAbsolute(dir)) {
    return dir;
  }
  return join(baseDir(), dir);
}

/** Returns the local date formatted as YYYY-MM-DD. */
export function dateStamp(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the report "as of" date: the previous calendar day, formatted as
 * YYYY-MM-DD. The reports are prior-day ending balances, so this is the date
 * used in CSV filenames and email subjects/bodies.
 */
export function reportDateStamp(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return dateStamp(d);
}

/** Reformats a YYYY-MM-DD stamp as MM/DD/YYYY for display in report titles. */
export function displayDate(stamp: string): string {
  const [year, month, day] = stamp.split("-");
  return `${month}/${day}/${year}`;
}

// ── CLI argument parsing ───────────────────────────────────────────────────

export interface CliArgs {
  /**
   * Dates to process, in ascending order.
   * An empty array signals the default / legacy mode: one iteration with no
   * TransactionDate passed to the stored procedures (they default internally).
   */
  dates: Date[];
}

/** Validates a YYYY-MM-DD string and returns a Date at midnight local time. */
function parseDateString(raw: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(
      `Invalid date format: "${raw}". Expected YYYY-MM-DD (e.g. 2026-06-14).`,
    );
  }
  const [year, month, day] = raw.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    throw new Error(`Invalid date: "${raw}" is not a real calendar date.`);
  }
  return d;
}

/** Returns yesterday at midnight (local). Used when --date-from has no --date-to. */
function yesterday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return d;
}

/**
 * Builds an inclusive, ascending array of Date objects from `from` through
 * `to` (both midnight-local).
 */
export function dateRange(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/**
 * Parses CLI flags into a list of dates to process.
 *
 * | Flags                                | Behaviour                                   |
 * |--------------------------------------|---------------------------------------------|
 * | (none)                               | default — one run with no TransactionDate   |
 * | `-d <date>` / `--date <date>`        | single day (backward-compatible shorthand)  |
 * | `--date-from <date>`                 | from that date through yesterday            |
 * | `--date-from <date> --date-to <date>`| explicit inclusive range                    |
 *
 * Throws on malformed dates, conflicts, or date-from > date-to.
 */
export function parseCliArgs(): CliArgs {
  const args = Deno.args;
  let singleDate: Date | undefined;
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "-d" || args[i] === "--date") && i + 1 < args.length) {
      if (dateFrom || dateTo) {
        throw new Error(
          "Cannot use --date together with --date-from / --date-to.",
        );
      }
      singleDate = parseDateString(args[i + 1]);
      i++; // consume value
    } else if (args[i] === "--date-from" && i + 1 < args.length) {
      if (singleDate) {
        throw new Error(
          "Cannot use --date together with --date-from / --date-to.",
        );
      }
      dateFrom = parseDateString(args[i + 1]);
      i++;
    } else if (args[i] === "--date-to" && i + 1 < args.length) {
      if (singleDate) {
        throw new Error(
          "Cannot use --date together with --date-from / --date-to.",
        );
      }
      dateTo = parseDateString(args[i + 1]);
      i++;
    }
  }

  // Single date (--date / -d)
  if (singleDate) return { dates: [singleDate] };

  // Date range (--date-from [--date-to])
  if (dateFrom) {
    const to = dateTo ?? yesterday();
    if (dateFrom > to) {
      throw new Error(
        `--date-from (${dateStamp(dateFrom)}) must not be after --date-to (${dateStamp(to)}).`,
      );
    }
    return { dates: dateRange(dateFrom, to) };
  }

  // --date-to without --date-from
  if (dateTo) {
    throw new Error("--date-to requires --date-from to also be specified.");
  }

  // Default: no flags
  return { dates: [] };
}
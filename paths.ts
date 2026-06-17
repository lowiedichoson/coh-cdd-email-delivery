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

/**
 * Parses an optional transaction date from CLI arguments.
 * Supports `-d <date>` or `--date <date>` where date is YYYY-MM-DD.
 * Returns the parsed Date (midnight, local) or undefined if no flag was given.
 * Throws on malformed input.
 */
export function parseCliDate(): Date | undefined {
  const args = Deno.args;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "-d" || args[i] === "--date") && i + 1 < args.length) {
      const raw = args[i + 1];
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
  }
  return undefined;
}
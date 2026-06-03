import chalk from "chalk";
import { join } from "@std/path";
import type { LogEntry, LogLevel, LogRun } from "./types.ts";

/** Steps captured during the current run, flushed to disk by `writeLogs`. */
export const logEntries: LogEntry[] = [];

const levelColor: Record<LogLevel, (s: string) => string> = {
  info: chalk.cyan,
  success: chalk.green,
  warn: chalk.yellow,
  error: chalk.red,
};

/** Fixed-width labels so the bracketed tags line up in the terminal. */
const levelLabel: Record<LogLevel, string> = {
  info: "INFO",
  success: " OK ",
  warn: "WARN",
  error: "FAIL",
};

/**
 * Records a step into the JSON log (plain text) and mirrors it to the console
 * as `[HH:MM:SS] [LEVEL] message`. Pass `display` to override the colored
 * message body while keeping the captured (plain) message intact.
 */
function record(level: LogLevel, message: string, display?: string): void {
  const now = new Date();
  logEntries.push({
    timestamp: now.toISOString(),
    level,
    message,
  });

  const time = chalk.gray(`[${now.toTimeString().slice(0, 8)}]`);
  const tag = levelColor[level](`[${levelLabel[level]}]`);
  const body = display ?? levelColor[level](message);
  console.log(`${time} ${tag} ${body}`);
}

export const logger = {
  info: (message: string, display?: string) => record("info", message, display),
  success: (message: string, display?: string) =>
    record("success", message, display),
  warn: (message: string, display?: string) => record("warn", message, display),
  error: (message: string, display?: string) =>
    record("error", message, display),
};

/**
 * Appends the current run's captured entries to {logDir}/logs-{YYYY-MM-DD}.json
 * and returns the path written to.
 */
export async function writeLogs(
  logDir: string,
  date: string,
  startedAt: string,
  exitCode: number,
): Promise<string> {
  await Deno.mkdir(logDir, { recursive: true });
  const path = join(logDir, `logs-${date}.json`);

  let runs: LogRun[] = [];
  try {
    const parsed = JSON.parse(await Deno.readTextFile(path));
    if (Array.isArray(parsed)) {
      runs = parsed;
    }
  } catch {
    // No existing log file (or it was unreadable); start a fresh array.
  }

  runs.push({
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode,
    entries: logEntries,
  });

  await Deno.writeTextFile(path, JSON.stringify(runs, null, 2));
  return path;
}

export interface RunSummary {
  startedAt: string;
  exitCode: number;
  cohRows: number;
  cddRows: number;
  filesWritten: number;
  emailsSent: number;
  logPath: string;
}

/** Prints a one-glance recap of the run: duration, counts, files, emails, status. */
export function printSummary(s: RunSummary): void {
  const elapsed = ((Date.now() - new Date(s.startedAt).getTime()) / 1000)
    .toFixed(1);
  const status = s.exitCode === 0 ? chalk.green("OK") : chalk.red("FAILED");
  const files = `${s.filesWritten} file${s.filesWritten === 1 ? "" : "s"}`;
  const emails = `${s.emailsSent} email${s.emailsSent === 1 ? "" : "s"}`;
  const bar = chalk.gray("|");

  console.log(chalk.gray("-".repeat(60)));
  console.log(
    `  Done in ${chalk.cyan(`${elapsed}s`)}  ${bar}  ` +
      `COH ${chalk.cyan(s.cohRows)}  CDD ${chalk.cyan(s.cddRows)}  ${bar}  ` +
      `${files}  ${bar}  ${emails}  ${bar}  ${status}`,
  );
  console.log(chalk.gray(`  logs -> ${s.logPath}`));
}

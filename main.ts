import type sql from "mssql";
import { join } from "@std/path";
import {
  dateStamp,
  displayDate,
  parseCliArgs,
  printHelp,
  resolveDir,
} from "./paths.ts";
import { logger, printSummary, writeLogs } from "./logger.ts";
import { loadEnv } from "./config.ts";
import {
  createPool,
  getCashDeliveryDepositData,
  getCashDeliveryDepositPerBankData,
  getCashOnHandData,
  getRecipients,
  testConnection,
} from "./db.ts";
import { sendReportEmail } from "./mailer.ts";
import { generateWorkbook } from "./report.ts";
import type {
  CashDeliveryDeposit,
  CashDeliveryDepositPerBank,
  CashOnHand,
  DayResult,
} from "./types.ts";

// ── Per-day processing ────────────────────────────────────────────────────

/**
 * Fetches, generates, and emails reports for a single date.
 * COH and CDD are handled independently — a failure in one won't block the
 * other, and the returned DayResult captures partial successes.
 */
async function processDay(
  pool: sql.ConnectionPool,
  reportsDir: string,
  transactionDate: Date | undefined,
): Promise<DayResult> {
  const reportDate = transactionDate ? dateStamp(transactionDate) : dateStamp(); // default: today — the SP defaults to CAST(GETDATE() AS DATE)
  const result: DayResult = {
    date: reportDate,
    success: true,
    cohRows: 0,
    cddRows: 0,
    cddPerBankRows: 0,
    filesWritten: 0,
    emailsSent: 0,
  };
  const errors: string[] = [];

  // ── COH ──
  try {
    const coh: CashOnHand[] | undefined = await getCashOnHandData(
      pool,
      transactionDate,
    );
    result.cohRows = coh?.length ?? 0;

    if (coh) {
      const cohPath = join(
        reportsDir,
        `COH Ending Balance(${reportDate}).xlsx`,
      );
      await generateWorkbook({
        filePath: cohPath,
        sheets: [{
          tabName: "COH Ending Balance",
          title: `Ending Balance As of ${displayDate(reportDate)}`,
          data: coh,
          totalColumns: [1, 2],
        }],
      });
      result.filesWritten++;
      const cohRecipients = await getRecipients(pool, "COH Report");
      if (!cohRecipients) {
        throw new Error(
          'No recipient row found in database for NotificationModule "COH Report".',
        );
      }
      await sendReportEmail("COH", reportDate, cohPath, cohRecipients);
      result.emailsSent++;
    }
  } catch (err) {
    result.success = false;
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`COH: ${msg}`);
    logger.error(`[${reportDate}] COH failed: ${msg}`);
  }

  // ── CDD (includes CDD Per Bank in one workbook) ──
  try {
    const cdd: CashDeliveryDeposit[] | undefined =
      await getCashDeliveryDepositData(pool, transactionDate);
    const cddPerBank: CashDeliveryDepositPerBank[] | undefined =
      await getCashDeliveryDepositPerBankData(pool, transactionDate);
    result.cddRows = cdd?.length ?? 0;
    result.cddPerBankRows = cddPerBank?.length ?? 0;

    if (cdd || cddPerBank) {
      const cddPath = join(reportsDir, `CDD Balance(${reportDate}).xlsx`);
      await generateWorkbook({
        filePath: cddPath,
        sheets: [
          {
            tabName: "CDD Ending Balance",
            title: `CDD Balance As of ${displayDate(reportDate)}`,
            data: cdd,
            totalColumns: [1, 2, 3, 4],
          },
          {
            tabName: "CDD Balance Per Bank",
            title: `CDD Balance Per Bank As of ${displayDate(reportDate)}`,
            data: cddPerBank,
            totalColumns: [1, 2, 3, 4],
          },
        ],
      });
      result.filesWritten++;
      const cddRecipients = await getRecipients(pool, "CDD Report");
      if (!cddRecipients) {
        throw new Error(
          'No recipient row found in database for NotificationModule "CDD Report".',
        );
      }
      await sendReportEmail("CDD", reportDate, cddPath, cddRecipients);
      result.emailsSent++;
    }
  } catch (err) {
    result.success = false;
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`CDD: ${msg}`);
    logger.error(`[${reportDate}] CDD failed: ${msg}`);
  }

  if (errors.length > 0) {
    result.error = errors.join("; ");
  }

  logger.info(
    `[${reportDate}] COH=${result.cohRows}  CDD=${result.cddRows}  CDD-B=${result.cddPerBankRows}  ` +
      `files=${result.filesWritten}  emails=${result.emailsSent}`,
  );

  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const startedAt = new Date().toISOString();
  const today = dateStamp(); // run date — used for the log filename

  const cliArgs = parseCliArgs();
  if (cliArgs.help) {
    printHelp();
    Deno.exit(0);
  }
  const runDates = cliArgs.dates; // [] = default mode (one iteration, no TransactionDate)
  let logDir = resolveDir("LOG_DIR", "logs");
  let pool: sql.ConnectionPool | undefined;
  let exitCode = 0;
  const dayResults: DayResult[] = [];

  try {
    await loadEnv();

    // Re-resolve once the .env values are available (in case it overrides the dirs).
    logDir = resolveDir("LOG_DIR", "logs");
    const reportsDir = resolveDir("REPORTS_DIR", "reports");

    pool = await createPool();
    await testConnection(pool);

    await Deno.mkdir(reportsDir, { recursive: true });

    if (runDates.length === 0) {
      // ── Default / legacy mode: single iteration ──
      const result = await processDay(pool, reportsDir, undefined);
      dayResults.push(result);
    } else {
      // ── Date-range mode ──
      logger.info(
        `Processing ${runDates.length} day(s): ${dateStamp(runDates[0])}` +
          (runDates.length > 1
            ? ` → ${dateStamp(runDates[runDates.length - 1])}`
            : ""),
      );
      for (const date of runDates) {
        try {
          const result = await processDay(pool, reportsDir, date);
          dayResults.push(result);
        } catch (err) {
          // Catch unexpected errors from processDay itself (shouldn't happen,
          // but guard against unhandled rejections from the event loop).
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`[${dateStamp(date)}] Unexpected error: ${msg}`);
          dayResults.push({
            date: dateStamp(date),
            success: false,
            error: msg,
            cohRows: 0,
            cddRows: 0,
            cddPerBankRows: 0,
            filesWritten: 0,
            emailsSent: 0,
          });
        }
      }
    }
  } catch (err) {
    logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
    exitCode = 1;
  } finally {
    await pool?.close();
    logger.success("Connection pool closed.");

    // Aggregate totals
    const totals = dayResults.reduce(
      (acc, d) => ({
        cohRows: acc.cohRows + d.cohRows,
        cddRows: acc.cddRows + d.cddRows,
        cddPerBankRows: acc.cddPerBankRows + d.cddPerBankRows,
        filesWritten: acc.filesWritten + d.filesWritten,
        emailsSent: acc.emailsSent + d.emailsSent,
      }),
      {
        cohRows: 0,
        cddRows: 0,
        cddPerBankRows: 0,
        filesWritten: 0,
        emailsSent: 0,
      },
    );

    const failedDays = dayResults.filter((d) => !d.success);
    if (failedDays.length > 0) exitCode = 1;

    const logPath = await writeLogs(logDir, today, startedAt, exitCode);
    printSummary({
      startedAt,
      exitCode,
      ...totals,
      logPath,
      dayResults,
      daysTotal: dayResults.length,
      daysSucceeded: dayResults.length - failedDays.length,
    });
  }

  Deno.exit(exitCode);
}

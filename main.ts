import type sql from "mssql";
import { join } from "@std/path";
import { dateStamp, reportDateStamp, resolveDir } from "./paths.ts";
import { logger, printSummary, writeLogs } from "./logger.ts";
import { loadEnv } from "./config.ts";
import {
  createPool,
  getCashDeliveryDepositData,
  getCashOnHandData,
  testConnection,
} from "./db.ts";
import { convertToCsv } from "./csv.ts";
import { sendReportEmail } from "./mailer.ts";

if (import.meta.main) {
  const startedAt = new Date().toISOString();
  const today = dateStamp(); // run date — used for the log filename
  const reportDate = reportDateStamp(); // prior day — used for reports + emails
  let logDir = resolveDir("LOG_DIR", "logs");
  let pool: sql.ConnectionPool | undefined;
  let exitCode = 0;
  let cohRows = 0;
  let cddRows = 0;
  let filesWritten = 0;
  let emailsSent = 0;

  try {
    await loadEnv();

    // Re-resolve once the .env values are available (in case it overrides the dirs).
    logDir = resolveDir("LOG_DIR", "logs");
    const reportsDir = resolveDir("REPORTS_DIR", "reports");

    pool = await createPool();

    await testConnection(pool);

    const coh = await getCashOnHandData(pool);
    const cdd = await getCashDeliveryDepositData(pool);
    cohRows = coh?.length ?? 0;
    cddRows = cdd?.length ?? 0;

    const cohCsv = convertToCsv(coh);
    const cddCsv = convertToCsv(cdd);

    if (cohCsv || cddCsv) {
      await Deno.mkdir(reportsDir, { recursive: true });
    }

    if (cohCsv) {
      const cohPath = join(reportsDir, `COH Ending Balance(${reportDate}).csv`);
      await Deno.writeTextFile(cohPath, cohCsv);
      filesWritten++;
      logger.success(`Cash on Hand report saved to ${cohPath}`);
      await sendReportEmail("COH", reportDate, cohPath);
      emailsSent++;
    }

    if (cddCsv) {
      const cddPath = join(reportsDir, `CDD Balance(${reportDate}).csv`);
      await Deno.writeTextFile(cddPath, cddCsv);
      filesWritten++;
      logger.success(`Cash Delivery Deposit report saved to ${cddPath}`);
      await sendReportEmail("CDD", reportDate, cddPath);
      emailsSent++;
    }

    logger.info(`Fetched: COH = ${cohRows}`);
    logger.info(`Fetched: CDD = ${cddRows}`);
  } catch (err) {
    logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
    exitCode = 1;
  } finally {
    await pool?.close();
    logger.success("Connection pool closed.");
    const logPath = await writeLogs(logDir, today, startedAt, exitCode);
    printSummary({
      startedAt,
      exitCode,
      cohRows,
      cddRows,
      filesWritten,
      emailsSent,
      logPath,
    });
  }

  Deno.exit(exitCode);
}

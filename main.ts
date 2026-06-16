import type sql from "mssql";
import { join } from "@std/path";
import {
  dateStamp,
  displayDate,
  reportDateStamp,
  resolveDir,
} from "./paths.ts";
import { logger, printSummary, writeLogs } from "./logger.ts";
import { loadEnv } from "./config.ts";
import {
  createPool,
  getCashDeliveryDepositData,
  getCashDeliveryDepositPerBankData,
  getCashOnHandData,
  testConnection,
} from "./db.ts";
import { sendReportEmail } from "./mailer.ts";
import { generateWorkbook } from "./report.ts";
import { CashDeliveryDeposit, CashDeliveryDepositPerBank, CashOnHand } from "./types.ts";

if (import.meta.main) {
  const startedAt = new Date().toISOString();
  const today = dateStamp(); // run date — used for the log filename
  const reportDate = reportDateStamp(); // prior day — used for reports + emails
  let logDir = resolveDir("LOG_DIR", "logs");
  let pool: sql.ConnectionPool | undefined;
  let exitCode = 0;
  let cohRows = 0;
  let cddRows = 0;
  let cddPerBankRows = 0;
  let filesWritten = 0;
  let emailsSent = 0;

  try {
    await loadEnv();

    // Re-resolve once the .env values are available (in case it overrides the dirs).
    logDir = resolveDir("LOG_DIR", "logs");
    const reportsDir = resolveDir("REPORTS_DIR", "reports");

    pool = await createPool();

    await testConnection(pool);

    const coh: CashOnHand[] | undefined = await getCashOnHandData(pool);
    const cdd: CashDeliveryDeposit[] | undefined = await getCashDeliveryDepositData(pool);
    const cddPerBank: CashDeliveryDepositPerBank[] | undefined = await getCashDeliveryDepositPerBankData(pool);
    cohRows = coh?.length ?? 0;
    cddRows = cdd?.length ?? 0;
    cddPerBankRows = cddPerBank?.length ?? 0;

    if (coh || cdd || cddPerBank) {
      await Deno.mkdir(reportsDir, { recursive: true });
    }

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

      filesWritten++;
      await sendReportEmail("COH", reportDate, cohPath);
      emailsSent++;
    }

    if (cdd || cddPerBank) {
      const cddPath = join(reportsDir, `CDD Balance(${reportDate}).xlsx`);
      await generateWorkbook({
        filePath: cddPath,
        sheets: [
          { 
            tabName: "CDD Ending Balance",
            title: `CDD Balance As of ${displayDate(reportDate)}`, 
            data: cdd,
            totalColumns: [1, 2, 3, 4]
          },
          { 
            tabName: "CDD Balance Per Bank",
            title: `CDD Balance Per Bank As of ${displayDate(reportDate)}`,
            data: cddPerBank,
            totalColumns: [1, 2, 3, 4]
          },
        ],
      });
      filesWritten++;
      await sendReportEmail("CDD", reportDate, cddPath);
      emailsSent++;
    }

    logger.info(`Fetched: COH = ${cohRows}`);
    logger.info(`Fetched: CDD = ${cddRows}`);
    logger.info(`Fetched: CDD Per Bank = ${cddPerBankRows}`);
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
      cddPerBankRows,
      filesWritten,
      emailsSent,
      logPath,
    });
  }

  Deno.exit(exitCode);
}

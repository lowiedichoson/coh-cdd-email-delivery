import "@std/dotenv/load";
import sql from "mssql";
import chalk from "chalk";
import * as mod from "@std/csv";

const log = console.log;

export function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function buildConfig(): sql.config {
  return {
    server: requireEnv("DB_HOST"),
    port: Number(requireEnv("DB_PORT")),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    options: {
      encrypt: Deno.env.get("DB_ENCRYPT") === "true",
      trustServerCertificate: true,
    },
    connectionTimeout: 10_000,
  };
}

export async function createPool(): Promise<sql.ConnectionPool> {
  const config = buildConfig();
  log(
    chalk.cyan(
      `Connecting to ${config.server}:${config.port}/${config.database} ...`,
    ),
  );

  const pool = new sql.ConnectionPool(config);
  pool.on("error", (err: Error) => {
    log(chalk.red(`Connection pool error: ${err.message}`));
  });

  await pool.connect();
  log(chalk.green("Connected to the database."));
  return pool;
}

export async function testConnection(pool: sql.ConnectionPool): Promise<void> {
  const result = await pool.request().query(
    "SELECT @@VERSION AS version, DB_NAME() AS db, SUSER_SNAME() AS login",
  );
  const row = result.recordset[0];
  log(chalk.white(`Logged in as : ${chalk.green(row.login)}`));
  log(chalk.white(`Database     : ${chalk.green(row.db)}`));
  log(
    chalk.white(
      `Server       : ${chalk.green(String(row.version).split("\n")[0])}`,
    ),
  );
}

export async function getCashOnHandData(
  pool: sql.ConnectionPool,
): Promise<sql.IRecordSet<Record<string, unknown>> | undefined> {
  const sp = "GetCOHEndingBalance";
  log(chalk.cyan("Retrieving Cash on Hand data from the database..."));

  const result = await pool.request().execute<Record<string, unknown>>(sp);
  if (result.recordset.length === 0) {
    log(chalk.yellow("No Cash on Hand data returned from the database."));
    return;
  }

  log(
    chalk.green(
      `Cash on Hand data retrieved successfully (${result.recordset.length} rows).`,
    ),
  );
  return result.recordset;
}

export async function getCashDeliveryDepositData(
  pool: sql.ConnectionPool,
): Promise<sql.IRecordSet<Record<string, unknown>> | undefined> {
  const sp = "GetCDDBalance";
  log(chalk.cyan("Retrieving Cash Delivery Deposit data from the database..."));

  const result = await pool.request().execute<Record<string, unknown>>(sp);
  if (result.recordset.length === 0) {
    log(
      chalk.yellow("No Cash Delivery Deposit data returned from the database."),
    );
    return;
  }

  log(
    chalk.green(
      `Cash Delivery Deposit data retrieved successfully (${result.recordset.length} rows).`,
    ),
  );
  return result.recordset;
}

export function convertToCsv(
  recordset: sql.IRecordSet<Record<string, unknown>>,
): string {
  if (!recordset || recordset.length === 0) {
    log(chalk.yellow("No data to convert to CSV."));
    return "";
  }

  const columns = Object.keys(recordset[0]);

  return mod.stringify(recordset, { columns, bom: true });
}

if (import.meta.main) {
  let pool: sql.ConnectionPool | undefined;
  let exitCode = 0;

  try {
    pool = await createPool();

    await testConnection(pool);

    const coh = await getCashOnHandData(pool);
    const cdd = await getCashDeliveryDepositData(pool);

    const cohCsv = convertToCsv(coh);
    const cddCsv = convertToCsv(cdd);

    if (cohCsv) {
      await Deno.writeTextFile("coh_report.csv", cohCsv);
      log(chalk.green("Cash on Hand report saved to coh_report.csv"));
    }

    if (cddCsv) {
      await Deno.writeTextFile("cdd_report.csv", cddCsv);
      log(chalk.green("Cash Delivery Deposit report saved to cdd_report.csv"));
    }

    log(chalk.gray(`Fetched: COH=${chalk.blue(coh?.length ?? 0)}`));
    log(chalk.gray(`Fetched: CDD=${chalk.blue(cdd?.length ?? 0)}`));

  } catch (err) {
    log(
      chalk.red(err instanceof Error ? err.stack ?? err.message : String(err)),
    );
    exitCode = 1;
  } finally {
    await pool?.close();
    log(chalk.green("Connection pool closed."));
  }

  Deno.exit(exitCode);
}

import sql from "mssql";
import chalk from "chalk";
import { logger } from "./logger.ts";
import { buildConfig } from "./config.ts";

export async function createPool(): Promise<sql.ConnectionPool> {
  const config = buildConfig();
  logger.info(
    `Connecting to ${config.server}:${config.port}/${config.database} ...`,
  );

  const pool = new sql.ConnectionPool(config);
  pool.on("error", (err: Error) => {
    logger.error(`Connection pool error: ${err.message}`);
  });

  await pool.connect();
  logger.success("Connected to the database.");
  return pool;
}

export async function testConnection(pool: sql.ConnectionPool): Promise<void> {
  const result = await pool.request().query(
    "SELECT @@VERSION AS version, DB_NAME() AS db, SUSER_SNAME() AS login",
  );
  const row = result.recordset[0];
  const server = String(row.version).split("\n")[0];
  logger.info(
    `Logged in as : ${row.login}`,
    chalk.white(`Logged in as : ${chalk.green(row.login)}`),
  );
  logger.info(
    `Database     : ${row.db}`,
    chalk.white(`Database     : ${chalk.green(row.db)}`),
  );
  logger.info(
    `Server       : ${server}`,
    chalk.white(`Server       : ${chalk.green(server)}`),
  );
}

export async function getCashOnHandData(
  pool: sql.ConnectionPool,
): Promise<sql.IRecordSet<Record<string, unknown>> | undefined> {
  const sp = "GetCOHEndingBalance";
  logger.info("Retrieving Cash on Hand data from the database...");

  const result = await pool.request().execute<Record<string, unknown>>(sp);
  if (result.recordset.length === 0) {
    logger.warn("No Cash on Hand data returned from the database.");
    return;
  }

  logger.success(
    `Cash on Hand data retrieved successfully (${result.recordset.length} rows).`,
  );
  return result.recordset;
}

export async function getCashDeliveryDepositData(
  pool: sql.ConnectionPool,
): Promise<sql.IRecordSet<Record<string, unknown>> | undefined> {
  const sp = "GetCDDBalance";
  logger.info("Retrieving Cash Delivery Deposit data from the database...");

  const result = await pool.request().execute<Record<string, unknown>>(sp);
  if (result.recordset.length === 0) {
    logger.warn("No Cash Delivery Deposit data returned from the database.");
    return;
  }

  logger.success(
    `Cash Delivery Deposit data retrieved successfully (${result.recordset.length} rows).`,
  );
  return result.recordset;
}

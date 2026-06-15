import sql from "mssql";
import chalk from "chalk";
import { logger } from "./logger.ts";
import { buildConfig } from "./config.ts";
import { CashDeliveryDeposit, CashDeliveryDepositPerBank, CashOnHand } from "./types.ts";

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
): Promise<CashOnHand[] | undefined> {
  const sp = "spGetCOHEndingBalance";
  logger.info("Retrieving Cash on Hand data from the database...");

  const result = await pool.request().execute<Record<string, unknown>>(sp);
  if (result.recordset.length === 0) {
    logger.warn("No Cash on Hand data returned from the database.");
    return;
  }

  const data: CashOnHand[] = result.recordset.map((row: Record<string, unknown>) => ({
    branchName: String(row["Branch Name"] ?? ""),
    cashOnHandPHP: Number(row["COH PHP"]) || 0,
    cashOnHandUSD: Number(row["COH USD"]) || 0,
  }));

  logger.success(
    `Cash on Hand data retrieved successfully (${data.length} rows).`,
  );
  return data;
}

export async function getCashDeliveryDepositData(
  pool: sql.ConnectionPool,
): Promise<CashDeliveryDeposit[] | undefined> {
  const sp = "spGetCDDBalance";
  logger.info("Retrieving Cash Delivery Deposit data from the database...");

  const result = await pool.request().execute<Record<string, unknown>>(sp);

  if (result.recordset.length === 0) {
    logger.warn("No Cash Delivery Deposit data returned from the database.");
    return;
  }
  
  const data: CashDeliveryDeposit[] = result.recordset.map((row: Record<string, unknown>) => ({
    branchName: String(row["Branch Name"] ?? ""),
    deliveryPHP: Number(row["Delivery PHP"]) || 0,
    deliveryUSD: Number(row["Delivery USD"]) || 0,
    depositPHP: Number(row["Deposit PHP"]) || 0,
    depositUSD: Number(row["Deposit USD"]) || 0,
  }));

  logger.success(
    `Cash Delivery Deposit data retrieved successfully (${data.length} rows).`,
  );
  return data;
}

export async function getCashDeliveryDepositPerBankData(
  pool: sql.ConnectionPool,
): Promise<CashDeliveryDepositPerBank[] | undefined> {
  const sp = "spGetCDDBalancePerBank";
  logger.info(
    "Retrieving Cash Delivery Deposit Per Bank data from the database...",
  );

  const result = await pool.request().execute<Record<string, unknown>>(sp);
  if (result.recordset.length === 0) {
    logger.warn(
      "No Cash Delivery Deposit Per Bank data returned from the database.",
    );
    return;
  }

  const data: CashDeliveryDepositPerBank[] = result.recordset.map((row: Record<string, unknown>) => ({
    bankCode: String(row["Bank Code"] ?? ""),
    deliveryPHP: Number(row["Delivery PHP"]) || 0,
    deliveryUSD: Number(row["Delivery USD"]) || 0,
    depositPHP: Number(row["Deposit PHP"]) || 0,
    depositUSD: Number(row["Deposit USD"]) || 0,
  }));

  logger.success(
    `Cash Delivery Deposit Per Bank data retrieved successfully (${data.length} rows).`,
  );
  return data;
}

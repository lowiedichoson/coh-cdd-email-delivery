/**
 * db-inline.ts
 *
 * Same API surface as `db.ts`, but instead of executing stored procedures
 * (`pool.request().execute(sp)`) it runs the equivalent inline SQL queries
 * built from the stored procedure definitions in the `scripts/` folder.
 *
 * The @TransactionDate default (yesterday) is computed in TypeScript and
 * passed as a named parameter so the queries stay parameterised.
 */

import sql from "mssql";
import chalk from "chalk";
import { logger } from "./logger.ts";
import { buildConfig } from "./config.ts";
import {
  CashDeliveryDeposit,
  CashDeliveryDepositPerBank,
  CashOnHand,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns yesterday's date as a JavaScript Date (midnight, local). */
function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Pool management (identical to db.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Data-retrieval functions (inline SQL versions)
// ---------------------------------------------------------------------------

/**
 * Inline equivalent of `spGetCOHEndingBalance`.
 *
 * Combines AR Topsheet and AR Main Vault ending balances for active branches
 * on the given transaction date (defaults to yesterday).
 */
export async function getCashOnHandData(
  pool: sql.ConnectionPool,
  transactionDate?: Date,
): Promise<CashOnHand[] | undefined> {
  const txDate = transactionDate ?? yesterday();
  logger.info(
    "Retrieving Cash on Hand data (inline query)...",
  );

  // prettier-ignore
  const sqlQuery = `
SET NOCOUNT ON;

WITH AR AS (
    -- Active branches with zero values as base
    SELECT
        [Name]                         AS [Branch Name],
        [Code]                         AS [Branch Code],
        CAST(0 AS DECIMAL(18,4))       AS [AR PHP],
        CAST(0 AS DECIMAL(18,4))       AS [AR USD],
        CAST(0 AS DECIMAL(18,4))       AS [MV PHP],
        CAST(0 AS DECIMAL(18,4))       AS [MV USD]
    FROM [Navision].[dbo].[E-Business Services Inc_$Dimension Value]
    WHERE [Dimension Code] = 'UNIT'
      AND SUBSTRING([Code], 1, 1) < '5'
      AND LEN(LTRIM(RTRIM([Code]))) >= 8
      AND RIGHT([Code], 3) <> '000'
      AND RIGHT([Code], 3) <> '999'
      AND [Blocked] = 0

    UNION ALL

    -- AR Topsheet balances pivoted to AR PHP / AR USD
    SELECT
        [Branch Name],
        [Branch Code],
        ISNULL(pvt2.PHP, 0),
        ISNULL(pvt2.USD, 0),
        0,
        0
    FROM (
        SELECT [Branch Code], [Branch Name], [Currency Code], [Ending Balance]
        FROM [Navision].[dbo].[E-Business Services Inc_$AR Topsheet]
        WHERE [TopSheet Date] = @TransactionDate
    ) AS pvt1
    PIVOT (SUM([Ending Balance]) FOR [Currency Code] IN (PHP, USD)) AS pvt2

    UNION ALL

    -- Main Vault balances pivoted to MV PHP / MV USD
    SELECT
        [Branch Name],
        [Branch Code],
        0,
        0,
        ISNULL(pvt4.PHP, 0),
        ISNULL(pvt4.USD, 0)
    FROM (
        SELECT [Branch Code], [Branch Name], [Currency Code], [Ending Balance]
        FROM [Navision].[dbo].[E-Business Services Inc_$AR Main Vault]
        WHERE [ARMV Date] = @TransactionDate
    ) AS pvt3
    PIVOT (SUM([Ending Balance]) FOR [Currency Code] IN (PHP, USD)) AS pvt4
)
SELECT
    TRIM([Branch Name])               AS [Branch Name],
    ISNULL(SUM([MV PHP]), 0) + ISNULL(SUM([AR PHP]), 0) AS [COH PHP],
    ISNULL(SUM([MV USD]), 0) + ISNULL(SUM([AR USD]), 0) AS [COH USD]
FROM AR
GROUP BY [Branch Name], [Branch Code]
ORDER BY [Branch Name];
`;

  const result = await pool.request()
    .input("TransactionDate", sql.Date, txDate)
    .query<Record<string, unknown>>(sqlQuery);

  if (result.recordset.length === 0) {
    logger.warn("No Cash on Hand data returned from the database.");
    return;
  }

  const data: CashOnHand[] = result.recordset.map(
    (row: Record<string, unknown>) => ({
      branchName: String(row["Branch Name"] ?? ""),
      cashOnHandPHP: Number(row["COH PHP"]) || 0,
      cashOnHandUSD: Number(row["COH USD"]) || 0,
    }),
  );

  logger.success(
    `Cash on Hand data retrieved successfully (${data.length} rows).`,
  );
  return data;
}

/**
 * Inline equivalent of `spGetCDDBalance`.
 *
 * Returns Delivery and Deposit amounts (PHP & USD) per branch for the given
 * transaction date (defaults to yesterday).
 */
export async function getCashDeliveryDepositData(
  pool: sql.ConnectionPool,
  transactionDate?: Date,
): Promise<CashDeliveryDeposit[] | undefined> {
  const txDate = transactionDate ?? yesterday();
  logger.info(
    "Retrieving Cash Delivery Deposit data (inline query)...",
  );

  // prettier-ignore
  const sqlQuery = `
SET NOCOUNT ON;

WITH DELDEP AS (
    -- Branch list with zero values as base
    SELECT
        [Name]                         AS [Branch Name],
        [Code]                         AS [Branch Code],
        CAST(0 AS DECIMAL(18,4))       AS [DEL PHP],
        CAST(0 AS DECIMAL(18,4))       AS [DEL USD],
        CAST(0 AS DECIMAL(18,4))       AS [DEP PHP],
        CAST(0 AS DECIMAL(18,4))       AS [DEP USD]
    FROM [Navision].[dbo].[E-Business Services Inc_$Dimension Value]
    WHERE [Dimension Code] = 'UNIT'
      AND SUBSTRING([Code], 1, 1) < '5'
      AND LEN(TRIM([Code])) >= 8
      AND RIGHT([Code], 3) NOT IN ('000', '999')
      AND [Blocked] = 0

    UNION ALL

    -- Cash deliveries only
    SELECT
        pvt2.[Name]                    AS [Branch Name],
        pvt2.[Branch Code],
        ISNULL(pvt2.PHP, 0),
        ISNULL(pvt2.USD, 0),
        CAST(0 AS DECIMAL(18,4)),
        CAST(0 AS DECIMAL(18,4))
    FROM (
        SELECT
            a.[Branch Code],
            b.[Name],
            a.[Currency Code],
            a.[Transfer Amount]
        FROM [Navision].[dbo].[Cash Delivery and Deposit] a
        INNER JOIN [Navision].[dbo].[E-Business Services Inc_$Dimension Value] b
            ON a.[Branch Code] = b.[Code]
        WHERE a.[Posting Date] = @TransactionDate
          AND a.[Transaction Type] <> 'DEP'
          AND a.[Status] = 2
    ) AS pvt1
    PIVOT (SUM([Transfer Amount]) FOR [Currency Code] IN (PHP, USD)) AS pvt2

    UNION ALL

    -- Cash deposits only
    SELECT
        pvt4.[Name]                    AS [Branch Name],
        pvt4.[Branch Code],
        CAST(0 AS DECIMAL(18,4)),
        CAST(0 AS DECIMAL(18,4)),
        ISNULL(pvt4.PHP, 0),
        ISNULL(pvt4.USD, 0)
    FROM (
        SELECT
            a.[Branch Code],
            b.[Name],
            a.[Currency Code],
            a.[Transfer Amount]
        FROM [Navision].[dbo].[Cash Delivery and Deposit] a
        INNER JOIN [Navision].[dbo].[E-Business Services Inc_$Dimension Value] b
            ON a.[Branch Code] = b.[Code]
        WHERE a.[Posting Date] = @TransactionDate
          AND a.[Transaction Type] = 'DEP'
          AND a.[Status] = 2
    ) AS pvt3
    PIVOT (SUM([Transfer Amount]) FOR [Currency Code] IN (PHP, USD)) AS pvt4
)
SELECT
    TRIM([Branch Name])                AS [Branch Name],
    ISNULL(SUM([DEL PHP]), 0)          AS [Delivery PHP],
    ISNULL(SUM([DEL USD]), 0)          AS [Delivery USD],
    ISNULL(SUM([DEP PHP]), 0)          AS [Deposit PHP],
    ISNULL(SUM([DEP USD]), 0)          AS [Deposit USD]
FROM DELDEP
GROUP BY [Branch Name], [Branch Code]
ORDER BY [Branch Name];
`;

  const result = await pool.request()
    .input("TransactionDate", sql.Date, txDate)
    .query<Record<string, unknown>>(sqlQuery);

  if (result.recordset.length === 0) {
    logger.warn("No Cash Delivery Deposit data returned from the database.");
    return;
  }

  const data: CashDeliveryDeposit[] = result.recordset.map(
    (row: Record<string, unknown>) => ({
      branchName: String(row["Branch Name"] ?? ""),
      deliveryPHP: Number(row["Delivery PHP"]) || 0,
      deliveryUSD: Number(row["Delivery USD"]) || 0,
      depositPHP: Number(row["Deposit PHP"]) || 0,
      depositUSD: Number(row["Deposit USD"]) || 0,
    }),
  );

  logger.success(
    `Cash Delivery Deposit data retrieved successfully (${data.length} rows).`,
  );
  return data;
}

/**
 * Inline equivalent of `spGetCDDBalancePerBank`.
 *
 * Returns Delivery and Deposit amounts (PHP & USD) grouped by bank for the
 * given transaction date (defaults to yesterday).
 */
export async function getCashDeliveryDepositPerBankData(
  pool: sql.ConnectionPool,
  transactionDate?: Date,
): Promise<CashDeliveryDepositPerBank[] | undefined> {
  const txDate = transactionDate ?? yesterday();
  logger.info(
    "Retrieving Cash Delivery Deposit Per Bank data (inline query)...",
  );

  // prettier-ignore
  const sqlQuery = `
SET NOCOUNT ON;

WITH BankData AS (
    SELECT
        a.[Bank Code],
        CASE WHEN a.[Transaction Type] = 'DEP' THEN 'DEP' ELSE 'DEL' END AS [TxnGroup],
        a.[Currency Code],
        a.[Transfer Amount]
    FROM [Navision].[dbo].[Cash Delivery and Deposit] a
    WHERE a.[Posting Date] = @TransactionDate
      AND a.[Status] = 2
),
Pivoted AS (
    SELECT
        [Bank Code],
        ISNULL([DEL_PHP], 0)  AS [Delivery PHP],
        ISNULL([DEL_USD], 0)  AS [Delivery USD],
        ISNULL([DEP_PHP], 0)  AS [Deposit PHP],
        ISNULL([DEP_USD], 0)  AS [Deposit USD]
    FROM (
        SELECT
            [Bank Code],
            [TxnGroup] + '_' + [Currency Code] AS [Category],
            SUM([Transfer Amount])             AS [Amount]
        FROM BankData
        GROUP BY [Bank Code], [TxnGroup], [Currency Code]
    ) src
    PIVOT (
        SUM([Amount]) FOR [Category] IN ([DEL_PHP], [DEL_USD], [DEP_PHP], [DEP_USD])
    ) pvt
)
-- Normal banks (excludes specific PNB/UCB branches)
SELECT
    CASE
        WHEN SUBSTRING([Bank Code], 2, 3) = 'MBC' THEN 'MBT'
        WHEN SUBSTRING([Bank Code], 2, 3) = 'RCB' THEN 'RCBC'
        WHEN SUBSTRING([Bank Code], 2, 3) = 'SEC' THEN 'SBC'
        WHEN SUBSTRING([Bank Code], 2, 3) = 'PNB' THEN 'PNB-Main'
        WHEN SUBSTRING([Bank Code], 2, 3) = 'UCB' THEN 'UCPB-Main'
        ELSE SUBSTRING([Bank Code], 2, 3)
    END                                AS [Bank Code],
    SUM([Delivery PHP])                AS [Delivery PHP],
    SUM([Delivery USD])                AS [Delivery USD],
    SUM([Deposit PHP])                 AS [Deposit PHP],
    SUM([Deposit USD])                 AS [Deposit USD]
FROM Pivoted
WHERE [Bank Code] NOT IN ('PPNB-002', 'DPNB-002', 'PUCB-001', 'DUCB-002')
GROUP BY SUBSTRING([Bank Code], 2, 3)

UNION

-- Excluded PNB/UCB branches mapped to different bank names
SELECT
    CASE
        WHEN SUBSTRING([Bank Code], 2, 3) = 'PNB' THEN 'PNB-Bangued'
        WHEN SUBSTRING([Bank Code], 2, 3) = 'UCB' THEN 'UCPB-Aklan'
        ELSE SUBSTRING([Bank Code], 2, 3)
    END                                AS [Bank Code],
    SUM([Delivery PHP])                AS [Delivery PHP],
    SUM([Delivery USD])                AS [Delivery USD],
    SUM([Deposit PHP])                 AS [Deposit PHP],
    SUM([Deposit USD])                 AS [Deposit USD]
FROM Pivoted
WHERE [Bank Code] IN ('PPNB-002', 'DPNB-002', 'PUCB-001', 'DUCB-002')
GROUP BY SUBSTRING([Bank Code], 2, 3);
`;

  const result = await pool.request()
    .input("TransactionDate", sql.Date, txDate)
    .query<Record<string, unknown>>(sqlQuery);

  if (result.recordset.length === 0) {
    logger.warn(
      "No Cash Delivery Deposit Per Bank data returned from the database.",
    );
    return;
  }

  const data: CashDeliveryDepositPerBank[] = result.recordset.map(
    (row: Record<string, unknown>) => ({
      bankCode: String(row["Bank Code"] ?? ""),
      deliveryPHP: Number(row["Delivery PHP"]) || 0,
      deliveryUSD: Number(row["Delivery USD"]) || 0,
      depositPHP: Number(row["Deposit PHP"]) || 0,
      depositUSD: Number(row["Deposit USD"]) || 0,
    }),
  );

  logger.success(
    `Cash Delivery Deposit Per Bank data retrieved successfully (${data.length} rows).`,
  );
  return data;
}

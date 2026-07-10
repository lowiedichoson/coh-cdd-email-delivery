import * as XLSX from "xlsx";
import { logger } from "./logger.ts";
import {
  CashDeliveryDeposit,
  CashDeliveryDepositPerBank,
  CashOnHand,
  SheetConfig,
  WorkbookConfig,
} from "./types.ts";

const COLUMN_LABELS: Record<string, string> = {
  branchName: "Branch Name",
  bankCode: "Bank Code",
  cashOnHandPHP: "COH PHP",
  cashOnHandUSD: "COH USD",
  deliveryPHP: "Delivery PHP",
  deliveryUSD: "Delivery USD",
  depositPHP: "Deposit PHP",
  depositUSD: "Deposit USD",
};

function getColumns(
  row: CashOnHand | CashDeliveryDeposit | CashDeliveryDepositPerBank,
): string[] {
  return Object.keys(row).filter((k) => k in COLUMN_LABELS);
}

function buildSheetRows(config: SheetConfig): unknown[][] | null {
  const { data, title } = config;

  if (!data || data.length === 0) {
    return null;
  }

  const columns = getColumns(data[0]);
  const rows: unknown[][] = [];

  if (title) {
    const titleRow: unknown[] = [title];
    for (let i = 1; i < columns.length; i++) {
      titleRow.push("");
    }
    rows.push(titleRow);
  }

  rows.push(columns.map((col) => COLUMN_LABELS[col]));

  for (const row of data) {
    rows.push(
      columns.map((col) => (row as unknown as Record<string, unknown>)[col]),
    );
  }

  if (config.totalColumns && config.totalColumns.length > 0) {
    const totalRow: unknown[] = new Array(columns.length).fill("");
    totalRow[0] = "Total";

    for (const colIdx of config.totalColumns) {
      const key = columns[colIdx];
      const sum = (data as unknown as Record<string, unknown>[]).reduce(
        (acc: number, record) => acc + (Number(record[key]) || 0),
        0,
      );
      totalRow[colIdx] = sum;
    }

    rows.push(totalRow);
  }
  return rows;
}

export async function generateWorkbook(config: WorkbookConfig): Promise<void> {
  const workbook = XLSX.utils.book_new();
  let sheetCount: number = 0;

  for (const sheet of config.sheets) {
    const rows = buildSheetRows(sheet);

    if (!rows) {
      logger.warn(`Skipping empty sheet ${sheet.tabName}`);
      continue;
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.tabName);
    sheetCount++;
    logger.info(
      `Added sheet ${sheet.tabName} with ${rows.length - 1} data rows`,
    );
  }

  if (sheetCount === 0) {
    logger.warn(
      `No sheets were added to the workbook. No file will be generated.`,
    );
    return;
  }

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  await Deno.writeFile(config.filePath, buffer);
  logger.success(
    `Workbook generated at ${config.filePath} with ${sheetCount} sheets`,
  );

  return;
}

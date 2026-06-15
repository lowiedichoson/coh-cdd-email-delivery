import * as XLSX from 'xlsx';
import { logger } from "./logger.ts";
import { SheetConfig, WorkbookConfig } from "./types.ts";

function buildSheetRows(config: SheetConfig): unknown[][] | null {
    const { recordset, title } = config;

    if (!recordset || recordset.length === 0){
        return null;
    }

    const columns = Object.keys(recordset[0]);
    const rows: unknown[][] = [];

    if (title) {
        rows.push([title]);
    }

    rows.push(columns);

    for (const record of recordset) {
        rows.push(columns.map(col => record[col]));
    }

    return rows;
}

export async function generateWorkbook(config: WorkbookConfig): Promise<void> {
    const workbook = XLSX.utils.book_new();
    let sheetCount: number = 0;

    for (const sheet of config.sheets){
        const rows = buildSheetRows(sheet);

        if (!rows) {
            logger.warn(`Skipping empty sheet ${sheet.tabName}`);
            continue;
        }

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.tabName);
        sheetCount++;
        logger.info(`Added sheet ${sheet.tabName} with ${rows.length - 1} data rows`);
    }

    if (sheetCount === 0) {
        logger.warn(`No sheets were added to the workbook. No file will be generated.`);
        return;
    }

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    await Deno.writeFile(config.filePath, buffer);
    logger.success(`Workbook generated at ${config.filePath} with ${sheetCount} sheets`);
}
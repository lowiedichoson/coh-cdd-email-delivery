import * as mod from "@std/csv";
import sql from "mssql";
import { logger } from "./logger.ts";

/** UTF-8 byte-order mark, kept at the very start of the file for Excel. */
const BOM = "﻿";

export interface CsvOptions {
  /** Optional title row placed above the column headers (e.g. a report caption). */
  title?: string;
}

export function convertToCsv(
  recordset: sql.IRecordSet<Record<string, unknown>> | undefined,
  options: CsvOptions = {},
): string {
  if (!recordset || recordset.length === 0) {
    logger.warn("No data to convert to CSV.");
    return "";
  }

  const columns = Object.keys(recordset[0]);
  // Build the header + data rows without a BOM so we can prepend our own
  // (and an optional title row) and keep a single BOM at the very start.
  const body = mod.stringify(recordset, { columns });

  if (options.title) {
    return `${BOM}${options.title}\r\n${body}`;
  }
  return `${BOM}${body}`;
}

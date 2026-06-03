import * as mod from "@std/csv";
import sql from "mssql";
import { logger } from "./logger.ts";

export function convertToCsv(
  recordset: sql.IRecordSet<Record<string, unknown>> | undefined,
): string {
  if (!recordset || recordset.length === 0) {
    logger.warn("No data to convert to CSV.");
    return "";
  }

  const columns = Object.keys(recordset[0]);

  return mod.stringify(recordset, { columns, bom: true });
}

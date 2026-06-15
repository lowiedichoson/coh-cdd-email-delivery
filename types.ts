import type sql from "mssql";

export type LogLevel = "info" | "success" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface LogRun {
  startedAt: string;
  finishedAt: string;
  exitCode: number;
  entries: LogEntry[];
}

export interface CashOnHand {
  branchName: string;
  cashOnHandPHP: number;
  cashOnHandUSD: number;
}

export interface CashDeliveryDeposit {
  branchName: string;
  deliveryPHP: number;
  deliveryUSD: number;
  depositPHP: number;
  depositUSD: number;
}

export interface WorkbookConfig {
  filePath: string;
  sheets: SheetConfig[];
}

export interface SheetConfig {
  tabName: string;
  title: string;
  recordset: sql.IRecordSet<Record<string, unknown>> | undefined;
}
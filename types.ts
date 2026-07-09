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

export interface CashDeliveryDepositPerBank {
  bankCode: string;
  deliveryPHP: number;
  deliveryUSD: number;
  depositPHP: number;
  depositUSD: number;
}

export type NotificationModule = "COH Report" | "CDD Report";

export interface EmailRecipients {
  to: string[];
  cc: string[];
  bcc: string[];
}

export interface WorkbookConfig {
  filePath: string;
  sheets: SheetConfig[];
}

export interface SheetConfig {
  tabName: string;
  title: string;
  data: CashOnHand[] | CashDeliveryDeposit[] | CashDeliveryDepositPerBank[] | undefined;
  /** 0-based column indices whose values should be summed in a "Total" row. */
  totalColumns?: number[];
}

/** Per-day result when processing a date range. */
export interface DayResult {
  date: string; // YYYY-MM-DD
  success: boolean;
  error?: string;
  cohRows: number;
  cddRows: number;
  cddPerBankRows: number;
  filesWritten: number;
  emailsSent: number;
}
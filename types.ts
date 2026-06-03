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

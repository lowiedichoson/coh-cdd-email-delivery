# Architecture

The application is intentionally small and divided into focused modules.

## Module map

- [main.ts](../main.ts): orchestrates the full run and handles per-day
  processing.
- [config.ts](../config.ts): loads `.env`, validates required settings, and
  builds the SQL config.
- [paths.ts](../paths.ts): resolves the base directory, derived paths, CLI
  argument parsing, and date helpers.
- [db.ts](../db.ts): opens the SQL connection, tests connectivity, and fetches
  report data and email recipients.
- [report.ts](../report.ts): generates Excel (.xlsx) workbooks from report data
  using SheetJS.
- [mailer.ts](../mailer.ts): builds SMTP transport and sends report emails with
  attachments.
- [csv.ts](../csv.ts): supplementary CSV string conversion utility (not used in
  the main report pipeline, which produces .xlsx).
- [logger.ts](../logger.ts): records structured logs and prints the final
  summary.

## Runtime boundaries

The app is a single process with a linear control flow:

`config -> database -> report data -> Excel workbook -> files -> email -> logs -> exit`

There is no queue, no background worker, and no state persisted between runs
beyond the log and report files.

## Error handling model

- Each report (COH and CDD) is processed independently — a failure in one does
  not block the other.
- Any top-level error is caught in the `try/catch` in `main.ts`.
- Failures are logged with the stack trace if available.
- The process exits with code `1` on failure and `0` on success (any failed day
  in a date range results in exit code `1`).

## Path model

All relative directories are anchored to the running executable, not the current
working directory. That makes the app behave the same when run from Deno source
or from a compiled Windows `.exe`.

## Data flow

1. `loadEnv()` reads `.env` beside the executable if present.
2. `buildConfig()` maps environment values to the SQL client configuration.
3. `createPool()` opens the connection.
4. `getCashOnHandData()`, `getCashDeliveryDepositData()`, and
   `getCashDeliveryDepositPerBankData()` execute stored procedures.
5. `getRecipients()` fetches email recipients per report module.
6. `generateWorkbook()` builds .xlsx workbooks (multi-sheet for CDD).
7. `sendReportEmail()` sends the workbook attachment through SMTP.
8. `writeLogs()` appends the run to the daily JSON log file.

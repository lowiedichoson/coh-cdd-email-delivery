# Architecture

The application is intentionally small and divided into focused modules.

## Module map

- [main.ts](../main.ts): orchestrates the full run.
- [config.ts](../config.ts): loads `.env`, validates required settings, and builds the SQL config.
- [paths.ts](../paths.ts): resolves the base directory and derived paths.
- [db.ts](../db.ts): opens the SQL connection and fetches report data.
- [csv.ts](../csv.ts): converts database rows to CSV text.
- [mailer.ts](../mailer.ts): builds SMTP transport and sends report emails.
- [logger.ts](../logger.ts): records structured logs and prints the final summary.

## Runtime boundaries

The app is a single process with a linear control flow:

`config -> database -> report data -> CSV -> files -> email -> logs -> exit`

There is no queue, no background worker, and no state persisted between runs beyond the log and report files.

## Error handling model

- Any thrown error is caught in the top-level `try/catch` in `main.ts`.
- Failures are logged with the stack trace if available.
- The process exits with code `1` on failure and `0` on success.

## Path model

All relative directories are anchored to the running executable, not the current working directory. That makes the app behave the same when run from Deno source or from a compiled Windows `.exe`.

## Data flow

1. `loadEnv()` reads `.env` beside the executable if present.
2. `buildConfig()` maps environment values to the SQL client configuration.
3. `createPool()` opens the connection.
4. `getCashOnHandData()` and `getCashDeliveryDepositData()` execute stored procedures.
5. `convertToCsv()` formats each result set.
6. `sendReportEmail()` sends the attachment through SMTP.
7. `writeLogs()` appends the run to the daily JSON log file.

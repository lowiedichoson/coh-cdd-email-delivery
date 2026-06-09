# COH / CDD Email Delivery

This directory documents the current Deno console application that pulls two SQL Server reports, converts them to CSV, saves them to disk, and emails each file as an attachment.

Start here:

- [Overview](./overview.md)
- [Architecture](./architecture.md)
- [Configuration](./configuration.md)
- [Runtime Flow](./runtime-flow.md)
- [Database](./database.md)
- [Reporting](./reporting.md)
- [Email Delivery](./email-delivery.md)
- [Logging & Monitoring](./logging-monitoring.md)
- [Testing](./testing.md)
- [Deployment](./deployment.md)
- [Troubleshooting](./troubleshooting.md)

## What this app does

- Loads environment variables from `.env` beside the executable, or uses the process environment if `.env` is missing.
- Connects to Microsoft SQL Server using `mssql`.
- Executes two stored procedures: `GetCOHEndingBalance` and `GetCDDBalance`.
- Converts each result set to CSV.
- Writes the CSV files to the reports directory.
- Sends one email per report with the CSV attached.
- Writes a dated JSON log file and prints a console summary.

## Source files

- [main.ts](../main.ts)
- [config.ts](../config.ts)
- [db.ts](../db.ts)
- [csv.ts](../csv.ts)
- [mailer.ts](../mailer.ts)
- [logger.ts](../logger.ts)
- [paths.ts](../paths.ts)
- [main_test.ts](../main_test.ts)

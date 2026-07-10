# COH / CDD Email Delivery

This directory documents the current Deno console application that pulls three
SQL Server reports, converts them to Excel (.xlsx) workbooks, saves them to
disk, and emails each file as an attachment.

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

- Loads environment variables from `.env` beside the executable, or uses the
  process environment if `.env` is missing.
- Connects to Microsoft SQL Server using `mssql`.
- Executes three stored procedures: `spGetCOHEndingBalance`,
  `spGetCDDBalance`, and `spGetCDDBalancePerBank`.
- Looks up email recipients from `spGetEmailRecipients`.
- Generates Excel (.xlsx) workbooks with formatted sheets and total rows.
- Writes the workbook files to the reports directory.
- Sends one email per report with the workbook attached.
- Writes a dated JSON log file and prints a console summary.

## Source files

- [main.ts](../main.ts) — orchestrator and CLI entry point
- [config.ts](../config.ts) — environment loading and config building
- [db.ts](../db.ts) — SQL Server connection pool and stored procedure calls
- [report.ts](../report.ts) — Excel (.xlsx) workbook generator
- [csv.ts](../csv.ts) — CSV string conversion utility (supplementary)
- [mailer.ts](../mailer.ts) — SMTP email sender
- [logger.ts](../logger.ts) — structured logging and console summary
- [paths.ts](../paths.ts) — path utilities, CLI arg parser, date helpers
- [main_test.ts](../main_test.ts) — test suite

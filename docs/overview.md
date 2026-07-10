# Overview

This application is a one-shot console job for generating and emailing three
daily reports:

- Cash on Hand (COH), sourced from `spGetCOHEndingBalance`
- Cash Delivery Deposit (CDD), sourced from `spGetCDDBalance`
- CDD Per Bank, sourced from `spGetCDDBalancePerBank`

The CDD workbook contains two sheets: an ending balance per branch and an
aggregated balance per bank.

It is designed to run non-interactively, usually from Windows Task Scheduler or
SQL Agent, and then exit with a success or failure code.

## Intended behavior

1. Load configuration.
2. Resolve output directories relative to the executable.
3. Connect to SQL Server.
4. Verify the connection with a small identity query.
5. Execute the three report stored procedures.
6. Look up email recipients from the database.
7. Generate Excel (.xlsx) workbooks with formatted sheets and totals.
8. Save the workbook files.
9. Email each workbook attachment.
10. Write a dated log file.
11. Print a summary and exit.

## What is in scope

- SQL Server connectivity
- Excel (.xlsx) workbook generation (multi-sheet)
- SMTP email delivery
- Logging and exit codes
- Environment-based configuration
- CLI date argument parsing (single date or date range)

## What is not in scope

- Web UI
- Interactive prompts
- Scheduling logic
- Deduplication or retry orchestration

## Important implementation note

Email recipients are looked up from the database via the `spGetEmailRecipients`
stored procedure (one call per report, keyed by `NotificationModule`), not from
environment variables. See [Email Delivery](./email-delivery.md) for details.

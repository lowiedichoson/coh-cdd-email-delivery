# Overview

This application is a one-shot console job for generating and emailing two daily reports:

- Cash on Hand, sourced from `GetCOHEndingBalance`
- Cash Delivery Deposit, sourced from `GetCDDBalance`

It is designed to run non-interactively, usually from Windows Task Scheduler or SQL Agent, and then exit with a success or failure code.

## Intended behavior

1. Load configuration.
2. Resolve output directories relative to the executable.
3. Connect to SQL Server.
4. Verify the connection with a small identity query.
5. Execute the two report stored procedures.
6. Convert the returned rows to CSV.
7. Save the report files.
8. Email each CSV attachment.
9. Write a dated log file.
10. Print a summary and exit.

## What is in scope

- SQL Server connectivity
- CSV report generation
- SMTP email delivery
- Logging and exit codes
- Environment-based configuration

## What is not in scope

- Web UI
- Interactive prompts
- Scheduling logic
- Deduplication or retry orchestration
- Recipient lookup from the database

## Important implementation note

The current code reads email recipients from environment variables, not from the database. If that changes later, update this overview and [Email Delivery](./email-delivery.md) together.

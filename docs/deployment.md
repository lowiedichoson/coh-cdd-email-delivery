# Deployment

This app is designed to be compiled into a standalone Windows executable with
Deno.

## Expected runtime layout

Place these items beside the executable:

- the `.exe`
- `.env`
- `logs/`
- `reports/`

The app resolves relative paths from the executable location, so the working
directory does not matter.

## Build and release notes

- Compile the app with Deno.
- Copy the executable and configuration to the target server.
- Ensure the service account or scheduled-task account can read `.env`, connect
  to SQL Server, write logs, and write reports.

## Scheduling

The app can be launched by either:

- Windows Task Scheduler
- SQL Agent Job

The scheduler only needs to run the executable once per day. The app handles the
rest.

## Deployment checks

- Confirm the `.env` file contains all required SQL and SMTP variables.
- Confirm the output directories are writable.
- Confirm the database account can execute both stored procedures.
- Confirm the SMTP relay allows the configured sender and recipients.

## Rollback

Rollback is simple because there is no local state beyond logs and report files.
Replace the executable and `.env` with the previous version if needed.

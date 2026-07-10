# Runtime Flow

This is the exact high-level sequence executed by `main.ts`.

## Step-by-step run order

1. Capture the run start time.
2. Parse CLI arguments (`--help`, `--date`, `--date-from`, `--date-to`).
3. Resolve the log directory.
4. Load `.env` if present.
5. Re-resolve the log and report directories after environment variables are
   loaded.
6. Open the SQL connection pool.
7. Verify the connection with a small
   `SELECT @@VERSION, DB_NAME(), SUSER_SNAME()` query.
8. Create the reports directory.
9. For each requested date (or a single default run):
   1. Execute `spGetCOHEndingBalance`.
   2. Look up COH email recipients via `spGetEmailRecipients`.
   3. Generate the COH Excel workbook.
   4. Email the COH workbook.
   5. Execute `spGetCDDBalance` and `spGetCDDBalancePerBank`.
   6. Look up CDD email recipients via `spGetEmailRecipients`.
   7. Generate the CDD Excel workbook (two sheets: per-branch + per-bank).
   8. Email the CDD workbook.
10. Close the connection pool.
11. Append the run to the log file.
12. Print the summary.
13. Exit with the captured exit code.

## Success and failure behavior

- Success uses exit code `0`.
- COH and CDD are handled independently per day — a failure in one does not
  block the other.
- Any exception sets the exit code to `1`.
- The final `finally` block always runs, so the pool is closed and the log
  summary is attempted even after failure.

## Empty-data behavior

If a stored procedure returns no rows, the workbook generation logs a warning
and returns without writing a file. In that case the app does not write a file
or send an email for that report. If both COH and CDD return empty for a day,
no file or email is produced for that day.

## Date-range behavior

When `--date-from` is supplied (optionally with `--date-to`), the app iterates
over each calendar date in the inclusive range, calling `processDay()` once per
date. The summary aggregates totals across all days and reports per-day
success/failure.

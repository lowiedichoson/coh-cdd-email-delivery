# Runtime Flow

This is the exact high-level sequence executed by `main.ts`.

## Step-by-step run order

1. Capture the run start time.
2. Compute the current date for the log file name.
3. Compute the prior calendar day for report filenames and email content.
4. Resolve the log directory.
5. Load `.env` if present.
6. Re-resolve the log and report directories after environment variables are
   loaded.
7. Open the SQL connection pool.
8. Verify the connection with a small
   `SELECT @@VERSION, DB_NAME(), SUSER_SNAME()` query.
9. Execute `GetCOHEndingBalance`.
10. Execute `GetCDDBalance`.
11. Convert both datasets to CSV.
12. Create the reports directory if at least one CSV was produced.
13. Write the COH report file, if present.
14. Email the COH report, if present.
15. Write the CDD report file, if present.
16. Email the CDD report, if present.
17. Log row counts for both datasets.
18. Close the connection pool.
19. Append the run to the log file.
20. Print the summary.
21. Exit with the captured exit code.

## Success and failure behavior

- Success uses exit code `0`.
- Any exception sets the exit code to `1`.
- The final `finally` block always runs, so the pool is closed and the log
  summary is attempted even after failure.

## Empty-data behavior

If a stored procedure returns no rows, CSV conversion logs a warning and returns
an empty string. In that case the app does not write a file or send an email for
that report.

# Troubleshooting

## Missing environment variable

Symptom: startup fails with `Missing required environment variable: ...`

Cause: the `.env` file is missing a required key, or the process environment
does not provide it.

Fix: add the key to `.env` or the host environment and rerun.

## No `.env` file found

Symptom: a warning says `.env` was not found and the app falls back to the
process environment.

Cause: the file is not beside the executable, or the app is being run from a
location that does not contain it.

Fix: place `.env` next to the executable or set the variables another way.

## Database connection failure

Symptom: the app fails during pool creation or connection verification.

Possible causes:

- bad host, port, database, username, or password
- network or firewall issue
- SQL login lacks permission

Fix: verify `DB_*` values and test connectivity from the same host.

## Empty report output

Symptom: no workbook file is written and no email is sent for a report.

Cause: the stored procedure returned zero rows.

Fix: verify the stored procedure result directly in SQL Server.

## SMTP send failure

Symptom: the app logs an error during the email step.

Possible causes:

- invalid SMTP host or port
- wrong username or password
- sender or recipient rejected by the relay
- TLS/SSL mismatch

Fix: check the SMTP settings and relay policy.

## Reports or logs not appearing where expected

Symptom: files are written to an unexpected location.

Cause: the app resolves relative paths from the executable directory, not the
current shell directory.

Fix: inspect the executable folder and confirm `LOG_DIR` / `REPORTS_DIR` if
custom paths are used.

# Logging & Monitoring

The app writes both console output and structured JSON log files.

## Console logging

[logger.ts](../logger.ts) prints each event with:

- a timestamp
- a level label
- the message text

Levels used by the app:

- `info`
- `success`
- `warn`
- `error`

## File logging

- Log files are written as `logs-YYYY-MM-DD.json`.
- They are stored in the log directory, which defaults to `logs` beside the executable.
- Each run appends a new entry to the JSON array in that file.

Each log entry contains:

- `startedAt`
- `finishedAt`
- `exitCode`
- `entries` recorded during the run

## Summary output

At the end of the run, the app prints a compact recap showing:

- elapsed time
- COH row count
- CDD row count
- number of files written
- number of emails sent
- success or failure status
- log path

## Operational use

Use the log file and summary together:

- If the app fails before reporting counts, look for the last `error` entry and the stack trace.
- If the app succeeds but a report is missing, check whether the corresponding result set was empty.
- If an email is missing, verify whether the file was written and whether the recipient variables are populated.

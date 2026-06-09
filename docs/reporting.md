# Reporting

The app generates CSV reports from SQL result sets.

## Report types

### Cash on Hand

- Output filename pattern: `COH Ending Balance(YYYY-MM-DD).csv`
- CSV title row: `Ending Balance As of MM/DD/YYYY`

### Cash Delivery Deposit

- Output filename pattern: `CDD Balance(YYYY-MM-DD).csv`
- CSV title row: none

## CSV format

- CSV text is generated with `@std/csv`.
- The output includes a UTF-8 BOM at the beginning of the file for Excel compatibility.
- Column order is based on the keys from the first row of the recordset.
- If the recordset is empty or undefined, no CSV is produced.

## File writing behavior

- Files are written to the reports directory, which defaults to `reports` beside the executable.
- The directory is created only if there is at least one report to write.
- Each successful write increments the `filesWritten` counter in the run summary.

## Practical developer notes

- The title row is only used for the COH report in the current code.
- If downstream consumers require a different header layout, `convertToCsv()` is the place to change it.

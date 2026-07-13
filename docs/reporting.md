# Reporting

The app generates Excel (.xlsx) workbooks from SQL result sets using the `xlsx`
(SheetJS) library.

## Report types

### Cash on Hand (COH)

- Output filename: `COH Ending Balance(YYYY-MM-DD).xlsx`
- Single sheet: "COH Ending Balance"
- Title row: `Ending Balance As of MM/DD/YYYY`
- Columns: Branch Name, COH PHP, COH USD
- Total row: sums PHP and USD columns

### Cash Delivery Deposit (CDD)

- Output filename: `CDD Balance(YYYY-MM-DD).xlsx`
- Two sheets in one workbook:
  - **CDD Ending Balance** — per-branch delivery/deposit amounts
    - Title: `CDD Balance As of MM/DD/YYYY`
    - Columns: Branch Name, Delivery PHP, Delivery USD, Deposit PHP, Deposit USD
    - Total row: sums all four currency columns
  - **CDD Balance Per Bank** — aggregated per bank code
    - Title: `CDD Balance Per Bank As of MM/DD/YYYY`
    - Columns: Bank Code, Delivery PHP, Delivery USD, Deposit PHP, Deposit USD
    - Total row: sums all four currency columns

## Workbook format

- Generated via `xlsx` (SheetJS) as `.xlsx` files.
- Column labels are mapped from internal field names to display names via
  `COLUMN_LABELS` in [report.ts](../report.ts):
  - `branchName` → "Branch Name"
  - `bankCode` → "Bank Code"
  - `cashOnHandPHP` → "COH PHP"
  - `cashOnHandUSD` → "COH USD"
  - `deliveryPHP` → "Delivery PHP"
  - `deliveryUSD` → "Delivery USD"
  - `depositPHP` → "Deposit PHP"
  - `depositUSD` → "Deposit USD"
- A "Total" row is appended when `totalColumns` is configured for a sheet.
- Empty sheets are skipped with a warning. If all sheets are empty, no file is
  written.

## File writing behavior

- Files are written to the reports directory, which defaults to `reports` beside
  the executable.
- The directory is created before processing begins.
- Each successful write increments the `filesWritten` counter in the run
  summary.

## Practical developer notes

- `generateWorkbook()` in [report.ts](../report.ts) is the single entry point
  for building .xlsx files.
- The CDD workbook combines two result sets (per-branch and per-bank) into
  separate sheets in one file.

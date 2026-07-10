# Database

The database layer lives in [db.ts](../db.ts) and uses the `mssql` package.

## Connection

The app uses SQL authentication with values from the environment.

- Server, port, user, password, and database come from `buildConfig()`.
- The pool is created once per run.
- Pool errors are logged if they occur after connection.

## Connection verification

After connecting, the app runs a simple identity query to confirm the session
can execute commands:

```sql
SELECT @@VERSION AS version, DB_NAME() AS db, SUSER_SNAME() AS login
```

This is used for startup diagnostics, not report data.

## Stored procedures

### Cash on Hand

- Procedure: `spGetCOHEndingBalance`
- Parameter: `@TransactionDate DATETIME = NULL` (passed as NVARCHAR to avoid
  timezone shift)
- Called from: `getCashOnHandData()`
- Returns: a recordset used for the COH sheet
- Encountered columns: `Branch Name`, `COH PHP`, `COH USD`

### Cash Delivery Deposit

- Procedure: `spGetCDDBalance`
- Parameter: `@TransactionDate DATETIME = NULL`
- Called from: `getCashDeliveryDepositData()`
- Returns: a recordset used for the CDD Ending Balance sheet
- Encountered columns: `Branch Name`, `Delivery PHP`, `Delivery USD`,
  `Deposit PHP`, `Deposit USD`

### CDD Per Bank

- Procedure: `spGetCDDBalancePerBank`
- Parameter: `@TransactionDate DATETIME = NULL`
- Called from: `getCashDeliveryDepositPerBankData()`
- Returns: a recordset used for the CDD Balance Per Bank sheet
- Encountered columns: `Bank Code`, `Delivery PHP`, `Delivery USD`,
  `Deposit PHP`, `Deposit USD`

### Email Recipients

- Procedure: `spGetEmailRecipients`
- Parameter: `@NotificationModule NVARCHAR(255)` — `"COH Report"` or
  `"CDD Report"`
- Called from: `getRecipients()`
- Returns: `EmailTo`, `EmailCC`, `EmailBCC` (semicolon-delimited lists in each
  field)

## Result handling

- An empty recordset logs a warning and returns `undefined`.
- A non-empty recordset logs a success message with the row count.
- DB rows are mapped to typed TypeScript interfaces (`CashOnHand`,
  `CashDeliveryDeposit`, `CashDeliveryDepositPerBank`).
- Column labels for the workbook are defined in `report.ts` via
  `COLUMN_LABELS`.

## Change impact

If any stored procedure name, return shape, or result semantics change, update
all of these documents together:

- [Database](./database.md)
- [Reporting](./reporting.md)
- [Testing](./testing.md)
- [Runtime Flow](./runtime-flow.md)

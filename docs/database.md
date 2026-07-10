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

- Procedure: `GetCOHEndingBalance`
- Called from: `getCashOnHandData()`
- Returns: a recordset used for the COH CSV report

### Cash Delivery Deposit

- Procedure: `GetCDDBalance`
- Called from: `getCashDeliveryDepositData()`
- Returns: a recordset used for the CDD CSV report

## Result handling

- An empty recordset logs a warning and returns `undefined`.
- A non-empty recordset logs a success message with the row count.
- The app does not currently transform column names or reorder fields in the DB
  layer; CSV generation uses the object keys from the first row.

## Change impact

If either stored procedure name, return shape, or result semantics change,
update all of these documents together:

- [Database](./database.md)
- [Reporting](./reporting.md)
- [Testing](./testing.md)
- [Runtime Flow](./runtime-flow.md)

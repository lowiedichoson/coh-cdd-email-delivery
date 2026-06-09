# Testing

The test suite in [main_test.ts](../main_test.ts) focuses on configuration and database helper behavior.

## Covered by tests

- `requireEnv()` returns values and throws when a key is missing.
- `buildConfig()` maps environment values into an SQL config object.
- Encryption behavior is covered for `DB_ENCRYPT=true` and `DB_ENCRYPT=false`.

## Integration tests

There are ignored integration tests for the database helpers:

- `getCashOnHandData()`
- `getCashDeliveryDepositData()`

These are currently ignored because they require a live database and the actual stored procedures.

## What is not tested yet

- CSV output formatting
- SMTP sending behavior
- log file content
- path resolution
- the full end-to-end `main.ts` orchestration

## Running tests

Use the Deno test command with the permissions required by the code under test. For the current unit tests, environment access is required.

If you enable the integration tests later, you will also need network access and the real database permissions.

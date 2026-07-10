# COH / CDD Email Delivery

A Deno console application that generates and emails daily financial reports
(Cash on Hand, Cash Delivery Deposit, and CDD Per Bank) as Excel (.xlsx)
workbooks.

Replaces a legacy .NET console app whose source code was lost. Compiled to a
standalone Windows `.exe` via `deno compile` — no runtime installation required
on the server.

## Setup

### Prerequisites

- [Deno 2.x](https://deno.com) — TypeScript runtime and package manager
- SQL Server — with the stored procedures defined in [scripts/](./scripts/)
- SMTP relay (e.g. Gmail SMTP) — for sending emails

### Clone and install

```sh
git clone <repo-url>
cd coh-cdd-email-delivery

# Deno auto-caches dependencies on first run — no separate install step needed.
# You can warm the cache ahead of time:
deno cache main.ts
```

### Configure

Copy the example below to `.env` in the project root and fill in your values:

```env
IS_PRODUCTION=false

DB_HOST=
DB_PORT=1433
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_ENCRYPT=false

SMTP_HOST=
SMTP_PORT=587
SMTP_ENABLE_SSL=true
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=

LOG_DIR=logs
REPORTS_DIR=reports
```

See [Configuration](./docs/configuration.md) for details on every variable.

### Run

```sh
# Development (watch mode, reloads on file changes)
deno task dev

# Single production-like run
deno task db:test

# Run tests
deno task test

# Build the standalone Windows .exe
deno task compile
```

## CLI usage

```
coh-cdd-email-delivery.exe [options]

  -h, --help                 Show help
  -d, --date <YYYY-MM-DD>    Process a single day
  --date-from <YYYY-MM-DD>   Start of a date range (through yesterday if no --date-to)
  --date-to <YYYY-MM-DD>     End of a date range (requires --date-from)

With no options, the app runs once using the stored procedures' internal defaults.
```

## How it works

1. Loads configuration from `.env` next to the executable.
2. Connects to SQL Server and verifies connectivity.
3. Executes three stored procedures:
   - `spGetCOHEndingBalance` — Cash on Hand per branch
   - `spGetCDDBalance` — Cash Delivery Deposit per branch
   - `spGetCDDBalancePerBank` — CDD aggregated per bank
4. Looks up email recipients via `spGetEmailRecipients`.
5. Generates Excel (.xlsx) workbooks with formatted sheets and totals.
6. Emails each workbook as an attachment via SMTP.
7. Writes a dated JSON log file and prints a console summary.
8. Exits with code `0` on success, `1` on failure.

## Documentation

See the [docs/](./docs/) directory for detailed documentation:

- [Overview](./docs/overview.md)
- [Architecture](./docs/architecture.md)
- [Configuration](./docs/configuration.md)
- [Runtime Flow](./docs/runtime-flow.md)
- [Database](./docs/database.md)
- [Reporting](./docs/reporting.md)
- [Email Delivery](./docs/email-delivery.md)
- [Logging & Monitoring](./docs/logging-monitoring.md)
- [Testing](./docs/testing.md)
- [Deployment](./docs/deployment.md)
- [Troubleshooting](./docs/troubleshooting.md)

## Dependencies

| Package    | Source | Purpose              |
|------------|--------|----------------------|
| `mssql`    | npm    | SQL Server client    |
| `nodemailer` | npm  | SMTP email client    |
| `xlsx`     | npm    | Excel (.xlsx) generation |
| `chalk`    | npm    | Colored console output |
| `@std/dotenv` | JSR | `.env` file loading |
| `@std/path`  | JSR | Path utilities     |
| `@std/csv`   | JSR | CSV string conversion (supplementary) |
| `zod`       | npm   | Schema validation (MCP server only) |

All dependencies are pure JavaScript (no native addons) so they bundle into the
compiled `.exe`.

## License

Proprietary. For internal use only.

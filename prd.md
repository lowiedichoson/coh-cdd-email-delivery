# PRD — COH CDD Email Delivery

**Status:** Implemented **Owner:** Lowie Dichoson **Last updated:** 2026-06-03
**Replaces:** Legacy production .NET console app (no source code, no logging, no
error handling)

---

## 1. Summary

A lightweight, standalone console application that runs once daily, executes
existing SQL Server stored procedures to produce financial reports, formats the
results into Excel (.xlsx) workbooks, and emails those files to recipients
fetched from the database. It replaces an existing .NET console app whose source
code is lost and which provided no error handling, logging, or diagnostics.

The application is built with **Deno** and compiled to a **single Windows
executable** (`.exe`) so it can be dropped onto a server and run by **SQL Agent
Job** or **Windows Task Scheduler** with no runtime to install.

---

## 2. Background & Problem

The current production process is a .NET console app that emails a daily report.
It is problematic because:

- **No source code** is available — it cannot be fixed, audited, or changed.
- **No error handling** — failures are silent.
- **No logging** — when it fails, there is no record of what happened or why.
- **No diagnostics** — operators cannot tell whether a run succeeded, was
  skipped, or failed.

The result is a fragile, opaque job that the team cannot trust or maintain.

---

## 3. Goals

1. Faithfully reproduce the current app's output and email delivery (a
   like-for-like replacement from the recipients' perspective).
2. Add **graceful error handling** via exceptions, with meaningful error
   messages.
3. Add **structured logging** to a file, so every run is diagnosable.
4. Be **standalone** — a single `.exe`, no runtime/dependencies to install on
   the server.
5. Be **lightweight**.
6. Be **environment-agnostic** — all connection and SMTP settings come from a
   `.env` file, so promoting between environments is just editing `.env`.
7. Be runnable by either **Windows Task Scheduler** or a **SQL Agent Job** that
   invokes the `.exe`.

### Non-Goals

- No web server, UI, or interactive mode (it is a one-shot console job).
- No self-scheduling/daemon mode — scheduling is owned by the OS/SQL job.
- No per-recipient/customer mail-merge — all recipients receive the same single
  file.

---

## 4. Users

- **Operations / DBAs** — schedule, monitor, and troubleshoot the job. Primary
  consumers of logs and exit codes.
- **Report recipients** — the people who receive the daily email + attachment.
  They should notice no difference from the current app.

---

## 5. Functional Requirements

### 5.1 Execution model

- **FR-1** (done) The app runs as a one-shot console process: start → do work →
  exit.
- **FR-2** (done) It runs once daily, triggered externally (Task Scheduler or
  SQL Agent Job).
- **FR-3** (done) It returns a zero exit code on success and a non-zero exit
  code on failure.

### 5.2 Configuration

- **FR-4** (done) All environment-specific settings (DB connection, SMTP) are
  read from a `.env` file located next to the executable.
- **FR-5** (done) On startup the app validates required configuration and fails
  fast with a clear message if anything is missing.
- **FR-6** (done) Secrets are never compiled into the binary.

### 5.3 Data retrieval

- **FR-7** (done) The app connects to MS SQL Server using SQL authentication.
- **FR-8** (done) It executes the same report stored procedures the current app
  uses: `spGetCOHEndingBalance`, `spGetCDDBalance`, and
  `spGetCDDBalancePerBank`.
- **FR-9** (done) It executes `spGetEmailRecipients` to fetch the recipient list
  per report module.

### 5.4 File generation

- **FR-10** (done) The app formats report data into Excel (.xlsx) workbooks.
- **FR-11** (done) Column labels, order, and layout use mapped display names
  defined in `COLUMN_LABELS`.

### 5.5 Email delivery

- **FR-12** (done) The app sends one email per report via SMTP relay with the
  workbook attached.
- **FR-13** (done) The recipient list comes from `spGetEmailRecipients`, not
  hardcoded.
- **FR-14** (done) Subject and body match the legacy app's format, with a
  `[TEST] -` prefix configurable via `IS_PRODUCTION`.

### 5.6 Reliability

- **FR-15** (not implemented) Retry with backoff for transient errors.
- **FR-16** (not implemented) Daily dedup ledger to prevent double-sending.
- **FR-17** (done) Empty result sets skip the report — no file or email is
  produced.

### 5.7 Logging & error handling

- **FR-18** (done) Every run writes to a dated JSON log file with timestamps for
  each stage.
- **FR-19** (done) All failures are caught as exceptions, logged with full stack
  traces, and surfaced via the non-zero exit code.

---

## 6. Non-Functional Requirements

- **NFR-1 (Packaging)** (done) Single Windows `.exe` via `deno compile`.
- **NFR-2 (Footprint)** (done) Lightweight; pure-JS dependencies.
- **NFR-3 (Portability)** (done) Behavior identical across environments given
  only a different `.env`.
- **NFR-4 (Security)** (done) Credentials live only in `.env`.
- **NFR-5 (Maintainability)** (done) Clear module boundaries.

---

## 7. Technical Implementation

| Concern     | Choice                       | Why                                                                        |
| ----------- | ---------------------------- | -------------------------------------------------------------------------- |
| Runtime     | Deno 2.x                     | Native single-executable compile; modern TS; no separate runtime on server |
| Packaging   | `deno compile`               | Produces the standalone `.exe`                                             |
| SQL Server  | `npm:mssql` (tedious driver) | Mature; pure JS so it bundles into the exe                                 |
| File (xlsx) | `npm:xlsx` (SheetJS)         | Pure JS; writes `.xlsx` with multi-sheet support                           |
| Email       | `npm:nodemailer`             | Pure JS SMTP client                                                        |
| Config      | `.env` (via `@std/dotenv`)   | Environment-agnostic; native Deno support                                  |
| Logging     | `chalk` + JSON file          | Console colors + structured file output                                    |

### Actual run flow

1. Load + validate `.env`.
2. Parse CLI args (optional date or date range).
3. Connect to SQL Server; verify connectivity.
4. For each date:
   - Execute `spGetCOHEndingBalance` → build COH .xlsx → lookup recipients →
     email.
   - Execute `spGetCDDBalance` + `spGetCDDBalancePerBank` → build CDD .xlsx (two
     sheets) → lookup recipients → email.
5. COH and CDD are independent — a failure in one does not block the other.
6. Log outcome; exit `0` on success, `1` on failure.

---

## 8. What Was Built (vs. Planned)

| Feature                    | Planned | Implemented                     |
| -------------------------- | ------- | ------------------------------- |
| SQL Server connectivity    | Yes     | Yes                             |
| CSV output                 | Yes     | No — .xlsx instead              |
| Excel (.xlsx) output       | No      | Yes (multi-sheet)               |
| 2 stored procedures        | Yes     | 3 (COH, CDD, CDD Per Bank)      |
| Email delivery             | Yes     | Yes                             |
| Recipients from DB         | Yes     | Yes                             |
| Dated JSON logs            | Yes     | Yes                             |
| Date range CLI             | No      | Yes (`--date-from`/`--date-to`) |
| Per-report error isolation | No      | Yes                             |
| Retry with backoff         | Yes     | No                              |
| Dedup ledger               | Yes     | No                              |
| `.xls` (legacy BIFF)       | TBD     | No (`.xlsx` only)               |

---

## 9. Success Criteria

- (done) The `.exe` runs on the server via Task Scheduler / SQL Agent Job and
  delivers daily email + attachments matching the legacy format.
- (done) Every run produces a log entry; failures are logged with cause and
  surface a non-zero exit code.
- (not done) A same-day re-run does not double-send.
- (done) Moving between environments requires only editing `.env`.
- (done) No runtime or dependencies need to be installed on the host beyond the
  single `.exe`.

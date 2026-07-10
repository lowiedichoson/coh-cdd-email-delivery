# PRD — COH CDD Email Delivery

**Status:** Draft (planning) **Owner:** Lowie Dichoson **Last updated:**
2026-06-03 **Replaces:** Legacy production .NET console app (no source code, no
logging, no error handling)

---

## 1. Summary

A lightweight, standalone console application that runs once daily, executes an
existing SQL Server stored procedure to produce a report, formats the result
into a file (CSV or legacy `.xls`), and emails that file to a set of recipients
fetched from the database. It replaces an existing .NET console app whose source
code is lost and which provides no error handling, logging, or diagnostics.

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

### Non-Goals (for v1)

- No web server, UI, or interactive mode (it is a one-shot console job).
- No self-scheduling/daemon mode — scheduling is owned by the OS/SQL job.
- No per-recipient/customer mail-merge — all recipients receive the same single
  file.
- No change to the underlying stored procedures or database schema.

---

## 4. Users

- **Operations / DBAs** — schedule, monitor, and troubleshoot the job. Primary
  consumers of logs and exit codes.
- **Report recipients** — the people who receive the daily email + attachment.
  They should notice no difference from the current app.

---

## 5. Functional Requirements

### 5.1 Execution model

- **FR-1** The app runs as a one-shot console process: start → do work → exit.
- **FR-2** It runs **once daily**, triggered externally (Task Scheduler or SQL
  Agent Job).
- **FR-3** It returns a **zero exit code** on success and a **non-zero exit
  code** on failure, so the scheduling job can detect failures.

### 5.2 Configuration

- **FR-4** All environment-specific settings (DB connection, SMTP) are read from
  a `.env` file located next to the executable.
- **FR-5** On startup the app **validates required configuration** and fails
  fast with a clear message if anything is missing or malformed.
- **FR-6** Secrets are never compiled into the binary.

### 5.3 Data retrieval

- **FR-7** The app connects to **MS SQL Server** using **SQL authentication**
  (username/password from `.env`).
- **FR-8** It executes the **same report stored procedure** the current app
  uses, to produce the report data. _(SP name + parameters: TBD — to be
  confirmed against the DB.)_
- **FR-9** It executes a **separate stored procedure** to fetch the **email
  recipients**. _(SP name + output columns: TBD — to be confirmed against the
  DB.)_

### 5.4 File generation

- **FR-10** The app formats the report data into a file whose **format matches
  the current app** (CSV or legacy `.xls`). _(Exact format + column layout: TBD
  — to be confirmed from a sample of the current app's output.)_
- **FR-11** The generated file's **columns, order, and headers mirror** the
  current app's output so recipients see no change.

### 5.5 Email delivery

- **FR-12** The app sends **one email** via an **SMTP relay**, with all
  recipients in the **TO/CC** fields, and the generated report file as a
  **single attachment**.
- **FR-13** The **recipient list** comes from the recipients stored procedure
  (FR-9), not hardcoded.
- **FR-14** The **subject and body match the current app**. _(Exact wording +
  source — config vs. DB — TBD.)_

### 5.6 Reliability & idempotency

- **FR-15** Transient DB/SMTP errors are **retried with backoff** before the run
  is considered failed.
- **FR-16** The app keeps a **daily dedup ledger** keyed by calendar date, so a
  re-run on the same day (after a crash or manual retry) does **not**
  double-send.
- **FR-17 (TBD)** Empty result set behavior **matches the current app** (send an
  empty file vs. skip + log). Default if unknown: **skip + log**.

### 5.7 Logging & error handling

- **FR-18** Every run writes to a **dated log file** beside the executable, with
  timestamps for each stage (config, DB connect, report SP, recipients SP, file
  build, email send, ledger update).
- **FR-19** All failures are caught as **exceptions**, logged with **full stack
  traces** and a human-readable error message, and surfaced via the non-zero
  exit code.

---

## 6. Non-Functional Requirements

- **NFR-1 (Packaging)** Delivered as a single Windows `.exe` via `deno compile`.
  All dependencies must be pure-JS so they bundle into the binary (no native
  addons).
- **NFR-2 (Footprint)** Lightweight; minimal dependencies; fast cold start
  suitable for a scheduled job.
- **NFR-3 (Portability)** Behavior identical across environments given only a
  different `.env`.
- **NFR-4 (Security)** Credentials live only in `.env` on the host; not in
  source, not in the binary, not in logs.
- **NFR-5 (Maintainability)** Clear module boundaries (config, db, report,
  mailer, logger, orchestration) so the report query/format can be changed in
  isolation.

---

## 7. Proposed Technical Approach

| Concern    | Choice                       | Why                                                                         |
| ---------- | ---------------------------- | --------------------------------------------------------------------------- |
| Runtime    | Deno 2.x                     | Native single-executable compile; modern TS; no separate runtime on server  |
| Packaging  | `deno compile`               | Produces the standalone `.exe`                                              |
| SQL Server | `npm:mssql` (tedious driver) | Mature; **pure JS** so it bundles into the exe (avoid native `msnodesqlv8`) |
| File (xls) | `npm:xlsx` (SheetJS)         | Pure JS; can write legacy BIFF8 `.xls` and modern formats                   |
| File (csv) | Hand-written                 | Zero dependency; lightest path                                              |
| Email      | `npm:nodemailer`             | Pure JS SMTP client                                                         |
| Config     | `.env`                       | Environment-agnostic; native Deno support                                   |

**Deployment unit on the server:** `email-delivery.exe` + `.env` + `logs/`
directory + dedup ledger file.

### Proposed `.env` schema (draft)

```
# SQL Server
DB_HOST=
DB_PORT=1433
DB_NAME=
DB_USER=
DB_PASS=
DB_ENCRYPT=true
DB_TRUST_SERVER_CERT=true

# Stored procedures
REPORT_PROC=
RECIPIENTS_PROC=

# SMTP relay
SMTP_HOST=
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# Misc
REPORT_FILENAME=report.xls
```

### High-level run flow

1. Load + validate `.env`.
2. Check dedup ledger — if today already sent, log and exit `0`.
3. Connect to SQL Server.
4. Execute report stored procedure → rows.
5. Execute recipients stored procedure → recipient list.
6. Apply empty-result rule (FR-17).
7. Build the report file (CSV or `.xls`) matching the current app.
8. Send one email (all recipients in TO/CC) with the file attached.
9. Record success in the dedup ledger (keyed by date).
10. Log outcome; exit `0` on success, non-zero on failure.

---

## 8. Open Questions / TBD

These resolve by inspecting the database (via the connected SQL MCP) and a
sample of the current app's output:

1. **Report stored procedure** — exact name and parameters (does it take a
   date?).
2. **Recipients stored procedure** — exact name and output columns (which hold
   the address, and any TO/CC distinction).
3. **Output format** — CSV vs. legacy `.xls`; if `.xls`, whether it is true
   binary BIFF or HTML/CSV saved with a `.xls` extension. Confirm column layout,
   order, headers, sheet name.
4. **Subject & body** — exact wording and whether they come from config or the
   DB.
5. **Empty result behavior** — send empty file vs. skip (FR-17).
6. **Dedup ledger location** — local JSON file beside the exe (preferred) vs. a
   SQL table.

---

## 9. Success Criteria

- The new `.exe` runs on the server via Task Scheduler / SQL Agent Job and
  delivers the same daily email + attachment the recipients receive today.
- Every run produces a log entry; failures are logged with cause and surface a
  non-zero exit code.
- A same-day re-run does not double-send.
- Moving between environments requires only editing `.env`.
- No runtime or dependencies need to be installed on the host beyond the single
  `.exe`.

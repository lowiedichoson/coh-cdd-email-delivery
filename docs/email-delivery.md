# Email Delivery

Email delivery is handled by [mailer.ts](../mailer.ts) with Nodemailer.

## Transport setup

The transport is built from SMTP environment variables.

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_ENABLE_SSL`

Rules:

- Port `465` uses implicit TLS.
- For other ports, `SMTP_ENABLE_SSL=true` enables STARTTLS behavior.
- The transport is closed after each send attempt.

## Recipients

Recipients come from the database, not from environment variables. The
`spGetEmailRecipients` stored procedure is called via `getRecipients` in
[db.ts](../db.ts), once per report using the `NotificationModule` parameter:

- COH report: `NotificationModule = "COH Report"`
- CDD report: `NotificationModule = "CDD Report"`

Each active row returns `EmailTo`, `EmailCC`, and `EmailBCC`, where each value
is a semicolon-separated (`;`) list of email addresses.

Notes:

- Addresses are trimmed and empty entries are ignored when splitting on `;`.
- If the procedure returns no rows for a module, the report's send step fails.
- If a report has no TO recipients, the app throws before sending.

## Message content

- Subject format: `[TEST] - COH YYYY-MM-DD` or `[TEST] - CDD YYYY-MM-DD` when
  `IS_PRODUCTION` is not `"true"`. In production (`IS_PRODUCTION=true`) the
  `[TEST] -` prefix is omitted.
- Body text: fixed legacy-style notification text with the report code and date.
- Attachment: the generated Excel (.xlsx) workbook file.

## Failure behavior

- SMTP send failures are allowed to bubble up to the top-level handler.
- A failed send causes the run to exit non-zero.
- The current implementation does not retry failed sends.

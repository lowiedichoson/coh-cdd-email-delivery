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

Recipients are read from indexed environment variables.

- TO list: `SMTP_RECIPIENTS_0`, `SMTP_RECIPIENTS_1`, ...
- CC list: `SMTP_CC_RECIPIENTS_0`, `SMTP_CC_RECIPIENTS_1`, ...

Notes:

- Empty values are ignored.
- Gaps in the numbering are tolerated.
- If no TO recipients are configured, the app throws before sending.

## Message content

- Subject format: `COH YYYY-MM-DD` or `CDD YYYY-MM-DD`
- Body text: fixed legacy-style notification text with the report code and date
- Attachment filename: the saved CSV file name

## Failure behavior

- SMTP send failures are allowed to bubble up to the top-level handler.
- A failed send causes the run to exit non-zero.
- The current implementation does not retry failed sends.

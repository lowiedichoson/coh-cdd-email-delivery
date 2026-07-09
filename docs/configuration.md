# Configuration

Configuration comes from environment variables. The app prefers a `.env` file beside the executable, but it will also work if the variables are injected directly into the process environment.

## Required SQL settings

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Optional:

- `DB_ENCRYPT` - set to `true` to enable SQL connection encryption

Behavior:

- Missing required values throw immediately during config building.
- `DB_PORT` is converted to a number.
- `trustServerCertificate` is always set to `true` in the current code.
- `connectionTimeout` is `10_000` ms.

## Required SMTP settings

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`

Optional:

- `SMTP_ENABLE_SSL` - when `true` and the port is not `465`, Nodemailer requires STARTTLS

Behavior:

- Recipients are fetched from the database (see [Email Delivery](./email-delivery.md)), not from environment variables.
- If a report has no TO recipients, the send step fails.
- Port `465` uses implicit TLS.

## Output directories

- `LOG_DIR` - defaults to `logs`
- `REPORTS_DIR` - defaults to `reports`

Both are resolved relative to the executable directory unless an absolute path is supplied.

## Example `.env`

```env
DB_HOST=sqlserver01
DB_PORT=1433
DB_USER=report_user
DB_PASSWORD=secret
DB_NAME=Finance
DB_ENCRYPT=false

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_ENABLE_SSL=true
SMTP_USERNAME=smtp-user
SMTP_PASSWORD=smtp-secret
SMTP_FROM_EMAIL=reports@example.com

LOG_DIR=logs
REPORTS_DIR=reports
```

## Validation rules

- Empty strings are treated as missing for required keys.
- `loadEnv()` logs whether `.env` was loaded or missing.
- The app does not validate address formats beyond what SMTP accepts.

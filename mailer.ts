// @ts-types="npm:@types/nodemailer@^6.4.17"
import nodemailer from "nodemailer";
import { basename } from "@std/path";
import { requireEnv } from "./config.ts";
import { logger } from "./logger.ts";

export type ReportCode = "COH" | "CDD";

/**
 * Collects indexed env vars like `${prefix}_0`, `${prefix}_1`, ... into a list.
 * Scans up to `max` indices and keeps every non-empty value, tolerating gaps.
 */
function collectIndexed(prefix: string, max = 100): string[] {
  const values: string[] = [];
  for (let i = 0; i < max; i++) {
    const value = Deno.env.get(`${prefix}_${i}`)?.trim();
    if (value) {
      values.push(value);
    }
  }
  return values;
}

/**
 * Builds an SMTP transport from the SMTP_* env vars. Port 465 uses implicit TLS;
 * other ports (e.g. 587) upgrade via STARTTLS when SMTP_ENABLE_SSL is true —
 * mirroring the legacy .NET `EnableSsl` behavior.
 */
function createTransport() {
  const port = Number(requireEnv("SMTP_PORT"));
  const enableSsl = Deno.env.get("SMTP_ENABLE_SSL") === "true";
  const secure = port === 465;
  return nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port,
    secure,
    requireTLS: !secure && enableSsl,
    auth: {
      user: requireEnv("SMTP_USERNAME"),
      pass: requireEnv("SMTP_PASSWORD"),
    },
  });
}

/** Subject + body matching the legacy app for a given report code and date. */
function buildMessage(code: ReportCode, date: string): {
  subject: string;
  text: string;
} {
  return {
    subject: `[TEST] - ${code} ${date}`,
    text: `Note: This is a notification email from Eterminal, please do not reply.` +
      `\n\n \n\nPlease see ${code} as of ${date}.`,
  };
}

/**
 * Sends one report email (COH or CDD) with the CSV file attached, to the
 * recipients in SMTP_RECIPIENTS_* (and SMTP_CC_RECIPIENTS_*). Throws on SMTP
 * failure so the caller can fail the run.
 */
export async function sendReportEmail(
  code: ReportCode,
  date: string,
  attachmentPath: string,
): Promise<void> {
  const to = collectIndexed("SMTP_RECIPIENTS");
  if (to.length === 0) {
    throw new Error(
      "No email recipients configured (set SMTP_RECIPIENTS_0, SMTP_RECIPIENTS_1, ...).",
    );
  }
  const cc = collectIndexed("SMTP_CC_RECIPIENTS");
  const from = requireEnv("SMTP_FROM_EMAIL");
  const { subject, text } = buildMessage(code, date);

  logger.info(
    `Sending "${subject}" to ${to.length} recipient(s)` +
      (cc.length ? ` (cc ${cc.length})` : "") + " ...",
  );

  const transport = createTransport();
  try {
    await transport.sendMail({
      from,
      to,
      cc: cc.length ? cc : undefined,
      subject,
      text,
      attachments: [{ filename: basename(attachmentPath), path: attachmentPath }],
    });
  } finally {
    transport.close();
  }

  logger.success(`Email sent: ${subject}`);
}

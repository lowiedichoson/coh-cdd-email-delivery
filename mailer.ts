// @ts-types="npm:@types/nodemailer@^6.4.17"
import nodemailer from "nodemailer";
import { basename } from "@std/path";
import { requireEnv } from "./config.ts";
import { logger } from "./logger.ts";
import type { EmailRecipients } from "./types.ts";

export type ReportCode = "COH" | "CDD";

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
  const isProduction = Deno.env.get("IS_PRODUCTION") === "true";
  const prefix = isProduction ? "" : "[TEST] - ";
  return {
    subject: `${prefix}${code} ${date}`,
    text: `Note: This is a notification email from Eterminal, please do not reply.` +
      `\n\n \n\nPlease see ${code} as of ${date}.`,
  };
}

/**
 * Sends one report email (COH or CDD) with the CSV file attached, to the
 * recipients resolved from the database (TO/CC/BCC). Throws on SMTP failure or
 * when there are no TO recipients so the caller can fail the run.
 */
export async function sendReportEmail(
  code: ReportCode,
  date: string,
  attachmentPath: string,
  recipients: EmailRecipients,
): Promise<void> {
  const { to, cc, bcc } = recipients;
  if (to.length === 0) {
    throw new Error(
      `EmailTo field is empty for NotificationModule "${code} Report" — no recipients to send to.`,
    );
  }
  const from = requireEnv("SMTP_FROM_EMAIL");
  const { subject, text } = buildMessage(code, date);

  logger.info(
    `Sending "${subject}" to ${to.length} recipient(s)` +
      (cc.length ? ` (cc ${cc.length})` : "") +
      (bcc.length ? ` (bcc ${bcc.length})` : "") + " ...",
  );

  const transport = createTransport();
  try {
    await transport.sendMail({
      from,
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      subject,
      text,
      attachments: [{ filename: basename(attachmentPath), path: attachmentPath }],
    });
  } finally {
    transport.close();
  }

  logger.success(`Email sent: ${subject}`);
}

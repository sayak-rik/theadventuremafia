// Email manager — one shared SMTP transport, plus high-level senders for the
// two flows. In local dev SMTP points at the MailHog container; in production
// set SMTP_* to a real provider. Sending failures never throw to the caller
// (a booking/enquiry must still succeed even if email is down) — they log.

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import {
  bookingConfirmation,
  bookingTeamNotification,
  contactNotification,
  contactAcknowledgement,
  otpEmail,
  type BookingEmailData,
  type ContactEmailData,
} from "./templates";

const globalForMail = globalThis as unknown as { mailTransport?: Transporter | null };

function getTransport(): Transporter | null {
  if (globalForMail.mailTransport !== undefined) return globalForMail.mailTransport;

  const host = process.env.SMTP_HOST;
  if (!host) {
    console.warn("[email] SMTP_HOST not set — emails will be skipped.");
    globalForMail.mailTransport = null;
    return null;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  // Mirror the proven Python flow: implicit TLS only when SMTP_SECURE=true
  // (port 465); otherwise force STARTTLS *before* AUTH (fixes GoDaddy 535).
  const secure = process.env.SMTP_SECURE === "true";

  globalForMail.mailTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: user ? { user, pass } : undefined,
    // GoDaddy's shared smtpout pool throttles bursts and resets connections —
    // keep one gentle reused connection and fail fast so retries kick in.
    pool: true,
    maxConnections: 1,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });
  return globalForMail.mailTransport;
}

const FROM = process.env.MAIL_FROM ?? "The Adventure Mafia <rides@theadventuremafia.in>";
const TEAM = process.env.TEAM_EMAIL ?? "team@theadventuremafia.in";

type Mail = { to: string; subject: string; html: string; text: string };

// GoDaddy resets/throttles connections under load; these are transient and
// worth retrying. Anything else (e.g. 535 auth) is a config error — don't retry.
const RETRYABLE = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNECTION", "ESOCKET", "ETIMEOUT"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(mail: Mail): Promise<boolean> {
  const transport = getTransport();
  if (!transport) return false;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await transport.sendMail({ from: FROM, ...mail });
      return true;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const retryable = !!code && RETRYABLE.has(code);
      if (retryable && attempt < maxAttempts) {
        const backoff = 500 * 2 ** (attempt - 1); // 500ms, 1s
        console.warn(
          `[email] transient ${code} sending "${mail.subject}" to ${mail.to} ` +
            `(attempt ${attempt}/${maxAttempts}), retrying in ${backoff}ms`,
        );
        await sleep(backoff);
        continue;
      }
      console.error(`[email] failed to send "${mail.subject}" to ${mail.to}:`, err);
      return false;
    }
  }
  return false;
}

/** Booking: notify the team AND send a confirmation to the customer. */
export async function sendBookingEmails(data: BookingEmailData): Promise<void> {
  const team = bookingTeamNotification(data);
  const customer = bookingConfirmation(data);
  await Promise.all([
    send({ to: TEAM, ...team }),
    send({ to: data.email, ...customer }),
  ]);
}

/** Send a rewards verification OTP. Returns whether it was actually sent. */
export async function sendOtpEmail(to: string, otp: string): Promise<boolean> {
  return send({ to, ...otpEmail(otp) });
}

/** Contact: notify the team AND acknowledge the sender. */
export async function sendContactEmails(data: ContactEmailData): Promise<void> {
  const team = contactNotification(data);
  const ack = contactAcknowledgement(data);
  await Promise.all([
    send({ to: TEAM, ...team }),
    send({ to: data.email, ...ack }),
  ]);
}

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

  globalForMail.mailTransport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: user ? { user, pass } : undefined,
  });
  return globalForMail.mailTransport;
}

const FROM = process.env.MAIL_FROM ?? "The Adventure Mafia <rides@theadventuremafia.in>";
const TEAM = process.env.TEAM_EMAIL ?? "team@theadventuremafia.in";

type Mail = { to: string; subject: string; html: string; text: string };

async function send(mail: Mail): Promise<boolean> {
  const transport = getTransport();
  if (!transport) return false;
  try {
    await transport.sendMail({ from: FROM, ...mail });
    return true;
  } catch (err) {
    console.error(`[email] failed to send "${mail.subject}" to ${mail.to}:`, err);
    return false;
  }
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

/** Contact: notify the team AND acknowledge the sender. */
export async function sendContactEmails(data: ContactEmailData): Promise<void> {
  const team = contactNotification(data);
  const ack = contactAcknowledgement(data);
  await Promise.all([
    send({ to: TEAM, ...team }),
    send({ to: data.email, ...ack }),
  ]);
}

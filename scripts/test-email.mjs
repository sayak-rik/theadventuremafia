// Quick SMTP credential check — verifies auth and optionally sends a test mail.
//
//   node --env-file=.env scripts/test-email.mjs            # verify only
//   node --env-file=.env scripts/test-email.mjs you@x.com  # verify + send test
//
// (or: npm run test:email -- you@x.com)

import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT = "587",
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  MAIL_FROM,
  TEAM_EMAIL,
} = process.env;

if (!SMTP_HOST) {
  console.error("✗ SMTP_HOST is not set. Did you pass --env-file=.env ?");
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: SMTP_SECURE === "true" || Number(SMTP_PORT) === 465,
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

console.log(`Verifying SMTP login ${SMTP_USER || "(no auth)"} @ ${SMTP_HOST}:${SMTP_PORT} ...`);

try {
  await transport.verify();
  console.log("✓ SMTP authentication OK");

  const to = process.argv[2] || TEAM_EMAIL;
  if (to) {
    const info = await transport.sendMail({
      from: MAIL_FROM || SMTP_USER,
      to,
      subject: "The Adventure Mafia — SMTP test ✅",
      text: "If you can read this, your SMTP credentials work.",
    });
    console.log(`✓ Test email sent to ${to} (id: ${info.messageId})`);
  }
} catch (err) {
  console.error("✗ SMTP failed:", err.message);
  if (err.responseCode === 535) {
    console.error(
      "\n  535 = authentication rejected. For Microsoft 365:\n" +
        "   • Enable 'Authenticated SMTP' for the mailbox (M365 admin → user → Mail → Manage email apps).\n" +
        "   • If MFA/Security Defaults are on, use an App Password as SMTP_PASS (not the normal password).\n" +
        "   • Or switch SMTP_* to a transactional provider (Brevo/Resend) — recommended for app email.",
    );
  }
  process.exit(1);
}

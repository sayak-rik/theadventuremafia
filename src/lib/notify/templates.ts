// Marketplace emails (operators, admin, customers). Same table-based chrome as
// the legacy emails, with the marketplace brand.

import { SITE } from "@/data/site";
import { COLORS, MARKETPLACE_BRAND, button, detailsTable, escapeHtml, paragraph, row, shell, type RenderedMail } from "../email/layout";

const brand = MARKETPLACE_BRAND;
const first = (name: string | null | undefined) => escapeHtml((name ?? "there").trim().split(" ")[0] || "there");

function otpBlock(otp: string): string {
  return `<div style="margin:18px 0;text-align:center;">
    <span style="display:inline-block;font-family:'Courier New',monospace;font-size:38px;font-weight:bold;letter-spacing:12px;color:${COLORS.navy};background:${COLORS.cream};border:1px solid ${COLORS.gold};border-radius:12px;padding:18px 28px;">${otp}</span>
  </div>`;
}

// ---- Operator account ------------------------------------------------------
export function operatorVerifyEmail(name: string | null, otp: string): RenderedMail {
  const body = `${paragraph(`Hi ${first(name)},`)}
    ${paragraph("Use this code to verify your email and finish creating your operator account:")}
    ${otpBlock(otp)}
    ${paragraph("This code expires in 10 minutes. If you didn&rsquo;t sign up, you can ignore this email.", true)}`;
  return {
    subject: `${otp} is your Adventure Mafia verification code`,
    html: shell({ brand, preheader: `Your code is ${otp}`, accent: COLORS.green, tagline: "Operator sign-up", heading: "Verify your email", body }),
    text: `Your Adventure Mafia verification code is ${otp}. It expires in 10 minutes.`,
  };
}

export function operatorResetEmail(name: string | null, otp: string): RenderedMail {
  const body = `${paragraph(`Hi ${first(name)},`)}
    ${paragraph("Use this code to reset your operator password:")}
    ${otpBlock(otp)}
    ${paragraph("This code expires in 10 minutes. If you didn&rsquo;t ask for a reset, ignore this email &mdash; your password is unchanged.", true)}`;
  return {
    subject: `${otp} is your password reset code`,
    html: shell({ brand, preheader: `Your reset code is ${otp}`, accent: COLORS.gold, tagline: "Password reset", heading: "Reset your password", body }),
    text: `Your Adventure Mafia password reset code is ${otp}. It expires in 10 minutes.`,
  };
}

export function operatorPendingEmail(name: string | null, companyName: string): RenderedMail {
  const body = `${paragraph(`Hi ${first(name)},`)}
    ${paragraph(`Thanks for signing up <strong>${escapeHtml(companyName)}</strong>. Our team will review your details and may call you to verify your business before approving it.`)}
    ${paragraph("While you wait, you can already add your payment details, vehicles or sessions and photos &mdash; they go live as soon as you&rsquo;re approved and each listing is reviewed.")}
    ${button("Open your dashboard", `${SITE.url}/dashboard`)}`;
  return {
    subject: "We received your operator application",
    html: shell({ brand, preheader: "Next: we verify your business, then you go live.", accent: COLORS.green, tagline: "Application received", heading: "You&rsquo;re in the queue", body }),
    text: `Thanks for signing up ${companyName}. We'll review and may call you to verify your business. Meanwhile set up your dashboard: ${SITE.url}/dashboard`,
  };
}

export function operatorApprovedEmail(name: string | null, companyName: string): RenderedMail {
  const body = `${paragraph(`Hi ${first(name)},`)}
    ${paragraph(`Good news &mdash; <strong>${escapeHtml(companyName)}</strong> is approved on The Adventure Mafia.`)}
    ${paragraph("You can now submit your listings for review. Make sure your UPI details are set up, because customers pay your advance directly to you.")}
    ${button("Go to your dashboard", `${SITE.url}/dashboard`)}`;
  return {
    subject: `${companyName} is approved`,
    html: shell({ brand, preheader: "You can now publish listings.", accent: COLORS.green, tagline: "Approved", heading: "Welcome aboard", body }),
    text: `${companyName} is approved. Submit your listings from ${SITE.url}/dashboard`,
  };
}

export function operatorRejectedEmail(name: string | null, companyName: string, reason: string | null): RenderedMail {
  const body = `${paragraph(`Hi ${first(name)},`)}
    ${paragraph(`We couldn&rsquo;t approve <strong>${escapeHtml(companyName)}</strong> right now.`)}
    ${reason ? `<div style="margin:8px 0 16px;padding:14px 16px;background:${COLORS.cream};border-left:4px solid ${COLORS.gold};border-radius:8px;">${escapeHtml(reason)}</div>` : ""}
    ${paragraph(`If you think this is a mistake or you can fix the above, reply to this email or call ${escapeHtml(SITE.phone)}.`)}`;
  return {
    subject: `Update on your application — ${companyName}`,
    html: shell({ brand, preheader: "About your operator application.", accent: COLORS.gold, tagline: "Application update", heading: "We couldn&rsquo;t approve this yet", body }),
    text: `We couldn't approve ${companyName} right now.${reason ? ` Reason: ${reason}` : ""} Reply to this email or call ${SITE.phone}.`,
  };
}

export function operatorSuspendedEmail(name: string | null, companyName: string, reason: string | null): RenderedMail {
  const body = `${paragraph(`Hi ${first(name)},`)}
    ${paragraph(`<strong>${escapeHtml(companyName)}</strong> has been suspended and its listings are hidden. Existing bookings stay visible in your dashboard so you can honour or cancel them.`)}
    ${reason ? `<div style="margin:8px 0 16px;padding:14px 16px;background:${COLORS.cream};border-left:4px solid ${COLORS.gold};border-radius:8px;">${escapeHtml(reason)}</div>` : ""}
    ${paragraph(`Please contact us on ${escapeHtml(SITE.phone)} to resolve this.`)}`;
  return {
    subject: `${companyName} has been suspended`,
    html: shell({ brand, preheader: "Your listings are hidden.", accent: COLORS.gold, tagline: "Account update", heading: "Account suspended", body }),
    text: `${companyName} has been suspended and its listings are hidden.${reason ? ` Reason: ${reason}` : ""} Contact ${SITE.phone}.`,
  };
}

export function adminNewOperatorEmail(d: { companyName: string; ownerName: string | null; email: string; phone: string; address: string | null; categories: string[] }): RenderedMail {
  const body = `${paragraph("A new operator verified their email and is waiting for approval.")}
    ${detailsTable(
      row("Business", escapeHtml(d.companyName)) +
        row("Owner", escapeHtml(d.ownerName ?? "-")) +
        row("Email", escapeHtml(d.email)) +
        row("Phone", escapeHtml(d.phone)) +
        row("Address", escapeHtml(d.address ?? "-")) +
        row("Offers", escapeHtml(d.categories.join(", ") || "-")),
    )}
    ${button("Review in admin", `${SITE.url}/admin/operators`, COLORS.gold)}`;
  return {
    subject: `New operator awaiting approval — ${d.companyName}`,
    html: shell({ brand, preheader: `${d.companyName} is waiting for approval.`, accent: COLORS.gold, tagline: "Action needed", heading: "New operator application", body }),
    text: `New operator: ${d.companyName}\nOwner: ${d.ownerName}\nEmail: ${d.email}\nPhone: ${d.phone}\nReview: ${SITE.url}/admin/operators`,
  };
}

// ---- Listing moderation ----------------------------------------------------
export function listingDecisionEmail(d: { name: string | null; title: string; decision: "published" | "changes_requested" | "rejected"; note: string | null }): RenderedMail {
  const copy = {
    published: { subject: `"${d.title}" is live`, tag: "Published", heading: "Your listing is live", line: "It&rsquo;s now visible to customers." },
    changes_requested: { subject: `Changes requested for "${d.title}"`, tag: "Changes requested", heading: "A few changes needed", line: "Please update the listing and submit it again." },
    rejected: { subject: `"${d.title}" wasn't approved`, tag: "Not approved", heading: "Listing not approved", line: "It won&rsquo;t be shown to customers." },
  }[d.decision];
  const body = `${paragraph(`Hi ${first(d.name)},`)}
    ${paragraph(`<strong>${escapeHtml(d.title)}</strong> &mdash; ${copy.line}`)}
    ${d.note ? `<div style="margin:8px 0 16px;padding:14px 16px;background:${COLORS.cream};border-left:4px solid ${COLORS.gold};border-radius:8px;">${escapeHtml(d.note)}</div>` : ""}
    ${button("Open dashboard", `${SITE.url}/dashboard/listings`)}`;
  return {
    subject: copy.subject,
    html: shell({ brand, preheader: copy.line.replace(/&rsquo;/g, "'"), accent: d.decision === "published" ? COLORS.green : COLORS.gold, tagline: copy.tag, heading: copy.heading, body }),
    text: `${copy.subject}\n${d.note ?? ""}\n${SITE.url}/dashboard/listings`,
  };
}

export function paymentDetailsChangedEmail(d: { name: string | null; companyName: string; summary: string }): RenderedMail {
  const body = `${paragraph(`Hi ${first(d.name)},`)}
    ${paragraph(`The payment details for <strong>${escapeHtml(d.companyName)}</strong> were just changed.`)}
    ${detailsTable(row("Now collecting on", escapeHtml(d.summary)))}
    ${paragraph("If this was you, nothing more to do. <strong>If it wasn&rsquo;t, reset your password immediately</strong> &mdash; all other devices have been signed out.")}
    ${button("Reset password", `${SITE.url}/dashboard/login`, COLORS.gold)}`;
  return {
    subject: "Your payment details were changed",
    html: shell({ brand, preheader: "Security notice: payment details changed.", accent: COLORS.gold, tagline: "Security notice", heading: "Payment details changed", body }),
    text: `The payment details for ${d.companyName} were changed (now: ${d.summary}). If this wasn't you, reset your password at ${SITE.url}/dashboard/login.`,
  };
}

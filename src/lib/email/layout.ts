// Shared, email-client-safe chrome (inline styles + table layout) used by both
// the legacy expedition emails and the marketplace emails.

import { SITE } from "@/data/site";

export const COLORS = {
  navy: "#0e1a24",
  navy2: "#122332",
  green: "#5bb02e",
  gold: "#c69c6d",
  cream: "#f5f3e8",
  ink: "#1f2a33",
  muted: "#6b7680",
};

export type Brand = {
  /** Wordmark in the header bar. */
  name: string;
  /** Small uppercase label on the right of the header bar. */
  regionLabel: string;
  /** Footer: line after the bold brand name. */
  footerTagline: string;
  /** Footer: last muted line. */
  footerNote: string;
};

/** Original expedition emails — output must stay byte-identical. */
export const LEGACY_BRAND: Brand = {
  name: "The Adventure Mafia",
  regionLabel: "West Sikkim",
  footerTagline: "Himalayan adventures in West &amp; North Sikkim",
  footerNote: "Motorcycle expeditions &middot; treks &amp; day hikes &middot; Sikkim ILP permits may apply",
};

export const MARKETPLACE_BRAND: Brand = {
  name: "The Adventure Mafia",
  regionLabel: "Pelling &middot; Sikkim",
  footerTagline: "Bike &amp; scooty rentals, river rafting &amp; paragliding in Pelling",
  footerNote: "Payments for bookings are made directly to the operator &mdash; The Adventure Mafia never holds your money.",
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function shell(opts: {
  preheader: string;
  accent: string;
  heading: string;
  tagline: string;
  body: string;
  brand?: Brand;
}): string {
  const brand = opts.brand ?? LEGACY_BRAND;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<title>${SITE.name}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.cream};font-family:Helvetica,Arial,sans-serif;color:${COLORS.ink};">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${opts.preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.cream};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 50px -20px rgba(14,26,36,0.35);">
  <!-- header -->
  <tr><td style="background:${COLORS.navy};padding:28px 32px;">
    <table role="presentation" width="100%"><tr>
      <td style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:${COLORS.cream};">${brand.name}</td>
      <td align="right" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${opts.accent};">${brand.regionLabel}</td>
    </tr></table>
  </td></tr>
  <!-- accent bar -->
  <tr><td style="height:4px;background:${opts.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
  <!-- hero heading -->
  <tr><td style="padding:32px 32px 8px 32px;">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${opts.accent};font-weight:bold;">${opts.tagline}</p>
    <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:${COLORS.navy};">${opts.heading}</h1>
  </td></tr>
  <!-- body -->
  <tr><td style="padding:12px 32px 8px 32px;font-size:15px;line-height:1.6;color:${COLORS.ink};">${opts.body}</td></tr>
  <!-- footer -->
  <tr><td style="padding:24px 32px 32px;border-top:1px solid #eee;color:${COLORS.muted};font-size:12px;line-height:1.6;">
    <strong style="color:${COLORS.navy};">${SITE.name}</strong> &middot; ${brand.footerTagline}<br/>
    <a href="mailto:${SITE.email}" style="color:${COLORS.green};text-decoration:none;">${SITE.email}</a> &middot; ${SITE.phone}<br/>
    <span style="color:${COLORS.muted};">${brand.footerNote}</span>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f0efe6;font-size:13px;color:${COLORS.muted};width:42%;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #f0efe6;font-size:14px;color:${COLORS.navy};font-weight:bold;">${value}</td>
  </tr>`;
}

export function detailsTable(rowsHtml: string): string {
  return `<table role="presentation" width="100%" style="margin:16px 0;border-collapse:collapse;">${rowsHtml}</table>`;
}

export function button(label: string, href: string, color: string = COLORS.green): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;"><tr><td style="border-radius:999px;background:${color};">
    <a href="${href}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">${label}</a>
  </td></tr></table>`;
}

export function paragraph(html: string, muted = false): string {
  return `<p style="margin:0 0 14px;${muted ? `color:${COLORS.muted};font-size:13px;` : ""}">${html}</p>`;
}

export type RenderedMail = { subject: string; html: string; text: string };

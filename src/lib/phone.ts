/**
 * Normalises a phone number to E.164. Accepts a 10-digit Indian mobile
 * (optionally with 0 / 91 / +91 prefix) or any international number written
 * with a leading + or 00. Returns null if it doesn't look like a phone number.
 */
export function normalizePhone(raw: string): string | null {
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (/^\+\d{8,15}$/.test(s)) return s;
  const m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(s);
  return m ? `+91${m[1]}` : null;
}

/** Digits only, for WhatsApp wa.me links. */
export function waNumber(e164: string): string {
  return e164.replace(/\D/g, "");
}

export function whatsappLink(e164: string, text?: string): string {
  const base = `https://wa.me/${waNumber(e164)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

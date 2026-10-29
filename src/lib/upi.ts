import QRCode from "qrcode";

// Matches the DB CHECK on company_payment_settings.upi_vpa.
const VPA_RE = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,30}$/;

export const isValidVpa = (vpa: string) => VPA_RE.test(vpa);

/**
 * Standard UPI payment link, e.g. upi://pay?pa=name@bank&pn=Shop&am=240.00&cu=INR&tn=BK-ABC123
 * `mc`/`tr` are merchant-only fields and are deliberately omitted.
 * The VPA is validated first so an operator-supplied value can never inject extra parameters.
 */
export function buildUpiUri(p: { vpa: string; payeeName: string; amount: number; note: string }): string {
  if (!isValidVpa(p.vpa)) throw new Error("Invalid UPI ID");
  if (!Number.isFinite(p.amount) || p.amount <= 0) throw new Error("Invalid amount");
  const enc = encodeURIComponent;
  return [
    `pa=${p.vpa}`, // '@' stays literal — some apps mishandle %40; the VPA charset has nothing else needing encoding
    `pn=${enc(p.payeeName.slice(0, 60))}`,
    `am=${p.amount.toFixed(2)}`,
    "cu=INR",
    `tn=${enc(p.note.slice(0, 40))}`,
  ].reduce((uri, part, i) => `${uri}${i === 0 ? "?" : "&"}${part}`, "upi://pay");
}

/** Inline-able SVG QR for a UPI link (rendered on the server — no client JS). */
export function upiQrSvg(uri: string): Promise<string> {
  return QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0e1a24", light: "#ffffff" } });
}

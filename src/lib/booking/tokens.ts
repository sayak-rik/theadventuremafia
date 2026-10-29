import crypto from "crypto";

/** 128-bit unguessable URL credential for a booking page. */
export const newBookingToken = () => crypto.randomBytes(16).toString("base64url");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

/** Short, readable code like BK-7K3Q9X. Display only — never a credential. */
export function newBookingCode(): string {
  let c = "";
  for (let i = 0; i < 6; i++) c += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  return `BK-${c}`;
}

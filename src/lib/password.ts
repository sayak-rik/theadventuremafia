import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

/** scrypt, stored as "salt:hash" (hex). Async so it never blocks the event loop. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)).toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const calc = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return calc.length === expected.length && crypto.timingSafeEqual(calc, expected);
}

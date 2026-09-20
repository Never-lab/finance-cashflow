/**
 * Hash e verifica password con scrypt (salt per utente).
 * Ruolo: auth — formato stored `scrypt:saltHex:hashHex`.
 * Privacy: non persistere password in chiaro; MIN_PASSWORD_LEN applicato anche in route.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_LEN = 16;
const KEY_LEN = 64;

/** Genera hash scrypt con salt casuale. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Confronto timing-safe con hash salvato. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1]!, "hex");
  const expected = Buffer.from(parts[2]!, "hex");
  const actual = scryptSync(password, salt, KEY_LEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Lunghezza minima password (allineata a messaggi route in italiano). */
export const MIN_PASSWORD_LEN = 8;

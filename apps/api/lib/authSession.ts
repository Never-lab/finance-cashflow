/**
 * Token di sessione firmati HMAC-SHA256 (idle + scadenza assoluta).
 * Ruolo: auth — env FINANCE_AUTH, FINANCE_SECRET; nessun storage server-side del token.
 * Privacy: il token contiene solo userId e timestamp; non includere PII nel payload.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Inattività massima prima di scadenza sessione (2 ore). */
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
/** Scadenza assoluta dal login (7 giorni). */
export const SESSION_ABS_MS = 7 * 24 * 60 * 60 * 1000;

const signBody = (body: string, secret: string) =>
  createHmac("sha256", secret).update(body).digest("hex");

const safeEqualHex = (a: string, b: string) => {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
};

export type SessionPayload = { userId: string; exp: number; abs: number };

/** Crea token `userId.exp.abs.firma`. */
export function makeSessionToken(userId: string, secret: string, now = Date.now()): string {
  const exp = now + SESSION_IDLE_MS;
  const abs = now + SESSION_ABS_MS;
  const body = `${userId}.${exp}.${abs}`;
  return `${body}.${signBody(body, secret)}`;
}

/** Verifica firma e scadenze; null se invalido o scaduto. */
export function readSessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, expStr, absStr, sig] = parts;
  if (!userId || !expStr || !absStr || !sig || !/^[0-9a-f]+$/i.test(sig)) return null;
  const body = `${userId}.${expStr}.${absStr}`;
  if (!safeEqualHex(sig, signBody(body, secret))) return null;
  const exp = Number(expStr);
  const abs = Number(absStr);
  if (!Number.isFinite(exp) || !Number.isFinite(abs)) return null;
  if (now > exp || now > abs) return null;
  return { userId, exp, abs };
}

/** Estende exp idle rispettando abs; null se sessione assoluta scaduta. */
export function refreshSessionToken(
  session: SessionPayload,
  secret: string,
  now = Date.now(),
): string | null {
  if (now > session.abs) return null;
  const exp = Math.min(session.abs, now + SESSION_IDLE_MS);
  const body = `${session.userId}.${exp}.${session.abs}`;
  return `${body}.${signBody(body, secret)}`;
}

/** Segreto HMAC da FINANCE_SECRET. */
export function getSessionSecret(): string | null {
  return process.env.FINANCE_SECRET?.trim() || null;
}

/** Auth attiva solo con FINANCE_AUTH=on. */
export function isAuthEnabled(): boolean {
  return process.env.FINANCE_AUTH === "on";
}

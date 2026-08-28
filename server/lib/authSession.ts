import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
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

export function makeSessionToken(userId: string, secret: string, now = Date.now()): string {
  const exp = now + SESSION_IDLE_MS;
  const abs = now + SESSION_ABS_MS;
  const body = `${userId}.${exp}.${abs}`;
  return `${body}.${signBody(body, secret)}`;
}

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

export function getSessionSecret(): string | null {
  return process.env.FINANCE_SECRET?.trim() || null;
}

export function isAuthEnabled(): boolean {
  return process.env.FINANCE_AUTH === "on";
}

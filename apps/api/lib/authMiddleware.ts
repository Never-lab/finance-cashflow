/**
 * Middleware Hono: protezione route /api/* con token sessione HMAC.
 * Ruolo: auth — bypass se FINANCE_AUTH off; eccezioni health e POST login/register.
 * Privacy: token in header Authorization Bearer; FINANCE_SECRET obbligatorio se auth on.
 */
import { createMiddleware } from "hono/factory";
import {
  getSessionSecret,
  isAuthEnabled,
  readSessionToken,
} from "./authSession";

/** Verifica sessione e imposta c.set('session') prima delle route business. */
export const authMiddleware = createMiddleware(async (c, next) => {
  if (!isAuthEnabled()) {
    await next();
    return;
  }

  const path = c.req.path;
  if (path === "/api/health") {
    await next();
    return;
  }
  if (path === "/api/bank-sync/callback" && c.req.method === "GET") {
    await next();
    return;
  }
  if (
    (path === "/api/auth/login" || path === "/api/auth/register") &&
    c.req.method === "POST"
  ) {
    await next();
    return;
  }

  const secret = getSessionSecret();
  if (!secret) {
    return c.json({ error: "Auth misconfigured: FINANCE_SECRET missing" }, 503);
  }

  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const session = readSessionToken(token, secret);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("session", session);
  await next();
});

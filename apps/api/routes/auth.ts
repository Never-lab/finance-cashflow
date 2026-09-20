/**
 * Route HTTP autenticazione: registrazione, login, sessione corrente.
 * Endpoint: POST /register, POST /login, GET /me (prefisso montaggio `/api/auth`).
 * Tabelle: auth_user (username, password_hash).
 * Privacy: password mai loggate; token HMAC in Authorization Bearer; rate limit per IP su login/register.
 */
import { Hono } from "hono";
import { getDb } from "../db";
import { verifyPassword, MIN_PASSWORD_LEN } from "../lib/authPassword";
import { createAuthUser, getAuthUserById, getAuthUserByUsername } from "../lib/authUser";
import { checkLoginRateLimit } from "../lib/loginRateLimit";
import {
  getSessionSecret,
  isAuthEnabled,
  makeSessionToken,
  readSessionToken,
  refreshSessionToken,
} from "../lib/authSession";

export const authRoutes = new Hono();

/** IP client per rate limiting (proxy-aware). */
function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

/** POST /api/auth/register — crea utente e restituisce token sessione. */
authRoutes.post("/register", async (c) => {
  if (!isAuthEnabled()) {
    return c.json({ error: "Auth disabled" }, 400);
  }
  const secret = getSessionSecret();
  if (!secret) {
    return c.json({ error: "Auth misconfigured" }, 503);
  }

  const ip = clientIp(c);
  if (!checkLoginRateLimit(ip)) {
    return c.json({ error: "Troppi tentativi. Riprova tra qualche minuto." }, 429);
  }

  const body = await c.req.json<{ username?: string; password?: string }>();
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!username) {
    return c.json({ error: "Username obbligatorio" }, 400);
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return c.json({ error: `Password minimo ${MIN_PASSWORD_LEN} caratteri` }, 400);
  }

  try {
    const user = createAuthUser(getDb(), username, password);
    const token = makeSessionToken(String(user.id), secret);
    return c.json({ token, username: user.username }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Registrazione fallita";
    if (msg.includes("already taken")) {
      return c.json({ error: "Username già in uso" }, 409);
    }
    return c.json({ error: msg }, 400);
  }
});

/** POST /api/auth/login — verifica credenziali e restituisce token. */
authRoutes.post("/login", async (c) => {
  if (!isAuthEnabled()) {
    return c.json({ error: "Auth disabled" }, 400);
  }
  const secret = getSessionSecret();
  if (!secret) {
    return c.json({ error: "Auth misconfigured" }, 503);
  }

  const ip = clientIp(c);
  if (!checkLoginRateLimit(ip)) {
    return c.json({ error: "Troppi tentativi. Riprova tra qualche minuto." }, 429);
  }

  const body = await c.req.json<{ username?: string; password?: string }>();
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  const user = getAuthUserByUsername(getDb(), username);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return c.json({ error: "Credenziali non valide" }, 401);
  }

  const token = makeSessionToken(String(user.id), secret);
  return c.json({ token, username: user.username });
});

/** GET /api/auth/me — profilo e refresh token se sessione valida. */
authRoutes.get("/me", (c) => {
  if (!isAuthEnabled()) {
    return c.json({ username: null, auth: false });
  }
  const secret = getSessionSecret();
  if (!secret) {
    return c.json({ error: "Auth misconfigured" }, 503);
  }

  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const session = readSessionToken(token, secret);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = getAuthUserById(getDb(), Number(session.userId));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const refreshed = refreshSessionToken(session, secret);
  if (!refreshed) {
    return c.json({ error: "Session expired" }, 401);
  }

  return c.json({ username: user.username, token: refreshed, auth: true });
});

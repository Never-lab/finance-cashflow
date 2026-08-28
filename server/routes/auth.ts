import { Hono } from "hono";
import { getDb } from "../db";
import { verifyPassword } from "../lib/authPassword";
import { getAuthUser } from "../lib/authUser";
import { checkLoginRateLimit } from "../lib/loginRateLimit";
import {
  getSessionSecret,
  isAuthEnabled,
  makeSessionToken,
  readSessionToken,
  refreshSessionToken,
} from "../lib/authSession";

export const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
  if (!isAuthEnabled()) {
    return c.json({ error: "Auth disabled" }, 400);
  }
  const secret = getSessionSecret();
  if (!secret) {
    return c.json({ error: "Auth misconfigured" }, 503);
  }

  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown";
  if (!checkLoginRateLimit(ip)) {
    return c.json({ error: "Troppi tentativi. Riprova tra qualche minuto." }, 429);
  }

  const body = await c.req.json<{ username?: string; password?: string }>();
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  const user = getAuthUser(getDb());

  if (!user || user.username !== username || !verifyPassword(password, user.password_hash)) {
    return c.json({ error: "Credenziali non valide" }, 401);
  }

  const token = makeSessionToken(String(user.id), secret);
  return c.json({ token, username: user.username });
});

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

  const user = getAuthUser(getDb());
  if (!user || String(user.id) !== session.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const refreshed = refreshSessionToken(session, secret);
  if (!refreshed) {
    return c.json({ error: "Session expired" }, 401);
  }

  return c.json({ username: user.username, token: refreshed, auth: true });
});

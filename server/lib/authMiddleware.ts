import { createMiddleware } from "hono/factory";
import {
  getSessionSecret,
  isAuthEnabled,
  readSessionToken,
} from "./authSession";

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
  if (path === "/api/auth/login" && c.req.method === "POST") {
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

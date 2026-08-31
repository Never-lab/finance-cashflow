import type { Context } from "hono";
import { isAuthEnabled } from "./authSession";
import type { AppEnv } from "./honoTypes";

export const DEFAULT_USER_ID = 1;

export function getUserId(c: Context<AppEnv>): number {
  const session = c.get("session");
  if (session) return Number(session.userId);
  if (!isAuthEnabled()) return DEFAULT_USER_ID;
  throw new Error("No session");
}

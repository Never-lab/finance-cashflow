/**
 * Contesto richiesta Hono: risoluzione user_id da sessione o default dev.
 * Ruolo: auth helper — usato da tutte le route protette.
 * Con FINANCE_AUTH=off usa DEFAULT_USER_ID=1 (utente bootstrap in migrations).
 */
import type { Context } from "hono";
import { isAuthEnabled } from "./authSession";
import type { AppEnv } from "./honoTypes";

/** Id utente usato quando l'autenticazione è disabilitata. */
export const DEFAULT_USER_ID = 1;

/**
 * Restituisce l'id numerico utente dalla sessione Hono o il default in modalità senza auth.
 * @throws se auth attiva ma sessione assente (non dovrebbe accadere post-middleware).
 */
export function getUserId(c: Context<AppEnv>): number {
  const session = c.get("session");
  if (session) return Number(session.userId);
  if (!isAuthEnabled()) return DEFAULT_USER_ID;
  throw new Error("No session");
}

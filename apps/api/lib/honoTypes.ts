/**
 * Tipi Hono condivisi: variabili di contesto (sessione JWT-like HMAC).
 * Ruolo: typing — AppEnv per route con Variables.session.
 */
import type { SessionPayload } from "./authSession";

export type AppVariables = {
  session: SessionPayload;
};

/** Ambiente Hono per route autenticate (middleware imposta session). */
export type AppEnv = { Variables: AppVariables };

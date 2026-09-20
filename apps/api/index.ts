/**
 * Punto di ingresso del server HTTP Node (Hono + @hono/node-server).
 * Ruolo: avvio processo — apre SQLite, esegue migrazioni/seed auth, monta l'app e ascolta la porta.
 * Non espone route dirette; la composizione è in {@link ./app.ts}.
 * Privacy: i dati finanziari restano sul file DB locale (vedi DATABASE_PATH in db.ts).
 */
import { serve } from "@hono/node-server";
import fs from "node:fs";
import path from "node:path";
import { createApp, DIST_DIR } from "./app";
import { getDb } from "./db";

/** Inizializza il singleton DB (schema, migrazioni, utente auth da env se abilitato). */
getDb();

const app = createApp();

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 5174);
serve({ fetch: app.fetch, port }, () => {
  const ui = fs.existsSync(path.join(DIST_DIR, "index.html")) ? " + UI" : "";
  const auth = process.env.FINANCE_AUTH === "on" ? " + auth" : "";
  console.log(`Server http://localhost:${port}${ui}${auth}`);
});

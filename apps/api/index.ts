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
import { syncAllLinkedUsers } from "./lib/bankSync";
import { isGoCardlessConfigured } from "./lib/gocardless";

/** Inizializza il singleton DB (schema, migrazioni, utente auth da env se abilitato). */
getDb();

const app = createApp();

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 5174);
serve({ fetch: app.fetch, port }, () => {
  const ui = fs.existsSync(path.join(DIST_DIR, "index.html")) ? " + UI" : "";
  const auth = process.env.FINANCE_AUTH === "on" ? " + auth" : "";
  console.log(`Server http://localhost:${port}${ui}${auth}`);
  startBankSyncCron();
});

/** Daily bank sync around 06:00 Europe/Rome. Disable with BANK_SYNC_CRON=off. */
function startBankSyncCron(): void {
  if (process.env.BANK_SYNC_CRON === "off") return;
  if (!isGoCardlessConfigured()) return;

  let lastRunDay = "";
  const tick = async () => {
    const nowRome = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }),
    );
    const day = nowRome.toISOString().slice(0, 10);
    if (nowRome.getHours() !== 6) return;
    if (lastRunDay === day) return;
    lastRunDay = day;
    try {
      console.log("[bank-sync] cron start");
      await syncAllLinkedUsers(getDb());
      console.log("[bank-sync] cron done");
    } catch (e) {
      console.error("[bank-sync] cron error", e);
    }
  };

  void tick();
  setInterval(() => void tick(), 60_000);
}

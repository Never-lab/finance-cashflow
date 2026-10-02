/**
 * Composizione applicazione Hono: health, auth, API protette e (opzionale) static UI.
 * Ruolo: wiring route → monta `/api/auth`, middleware sessione su `/api/*`, domini state/instruments/portfolio/quotes/settings/loans/payslips/vault/budget.
 * Path: `__dirname` = cartella compilata di questo file; ROOT = monorepo (due livelli sopra); DIST_DIR = build frontend in `ROOT/dist`.
 * Privacy: con FINANCE_AUTH=on tutte le API (tranne health e login/register) richiedono Bearer token; i cedolini passano da payslips (PDF su volume + SQLite).
 */
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { authMiddleware } from "./lib/authMiddleware";
import { isAuthEnabled } from "./lib/authSession";
import { authRoutes } from "./routes/auth";
import { stateRoutes } from "./routes/state";
import { instrumentsRoutes } from "./routes/instruments";
import { portfolioRoutes } from "./routes/portfolio";
import { quotesRoutes } from "./routes/quotes";
import { settingsRoutes } from "./routes/settings";
import { loansRoutes } from "./routes/loans";
import { payslipsRoutes } from "./routes/payslips";
import { vaultRoutes } from "./routes/vault";
import { budgetRoutes } from "./routes/budget";
import { bankSyncRoutes } from "./routes/bankSync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Radice del repository (apps/api → apps → repo root). */
const ROOT = path.join(__dirname, "../..");
/** Directory della build Vite del frontend; se contiene index.html si abilita SPA fallback. */
export const DIST_DIR = path.join(ROOT, "dist");

/**
 * Crea e configura l'istanza Hono (route API + static opzionale).
 * @returns App pronta per `serve({ fetch: app.fetch })`.
 */
export function createApp(): Hono {
  const app = new Hono();

  /** GET /api/health — stato servizio, storage sqlite, flag auth. */
  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      storage: "sqlite",
      auth: isAuthEnabled(),
    }),
  );

  app.route("/api/auth", authRoutes);

  app.use("/api/*", authMiddleware);

  app.route("/api", stateRoutes);
  app.route("/api", instrumentsRoutes);
  app.route("/api", portfolioRoutes);
  app.route("/api", quotesRoutes);
  app.route("/api", settingsRoutes);
  app.route("/api", loansRoutes);
  app.route("/api", payslipsRoutes);
  app.route("/api", vaultRoutes);
  app.route("/api", budgetRoutes);
  app.route("/api", bankSyncRoutes);

  if (fs.existsSync(path.join(DIST_DIR, "index.html"))) {
    app.use(
      "/assets/*",
      serveStatic({
        root: DIST_DIR,
        onFound: (_path, c) => {
          c.header("Cache-Control", "public, max-age=31536000, immutable");
        },
      }),
    );

    app.notFound(async (c) => {
      if (c.req.path.startsWith("/api")) {
        return c.json({ error: "Not found" }, 404);
      }
      c.header("Cache-Control", "no-cache");
      const result = await serveStatic({ root: DIST_DIR, path: "index.html" })(
        c,
        () => Promise.resolve(),
      );
      if (result instanceof Response) return result;
      return c.text("Not Found", 404);
    });
  }

  return app;
}

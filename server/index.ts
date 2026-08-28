import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { getDb } from "./db";
import { stateRoutes } from "./routes/state";
import { instrumentsRoutes } from "./routes/instruments";
import { portfolioRoutes } from "./routes/portfolio";
import { quotesRoutes } from "./routes/quotes";
import { settingsRoutes } from "./routes/settings";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

getDb(); // ensure migrate on boot

const app = new Hono();
app.get("/api/health", (c) =>
  c.json({
    ok: true,
    storage: "sqlite",
    auth: process.env.FINANCE_AUTH === "on",
  }),
);
app.route("/api", stateRoutes);
app.route("/api", instrumentsRoutes);
app.route("/api", portfolioRoutes);
app.route("/api", quotesRoutes);
app.route("/api", settingsRoutes);

if (fs.existsSync(path.join(DIST, "index.html"))) {
  app.use(
    "/assets/*",
    serveStatic({
      root: DIST,
      onFound: (_path, c) => {
        c.header("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );

  app.notFound((c) => {
    if (c.req.path.startsWith("/api")) {
      return c.json({ error: "Not found" }, 404);
    }
    c.header("Cache-Control", "no-cache");
    return serveStatic({ root: DIST, path: "index.html" })(c, () => c.text("Not Found", 404));
  });
}

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 5174);
serve({ fetch: app.fetch, port }, () => {
  const ui = fs.existsSync(path.join(DIST, "index.html")) ? " + UI" : "";
  console.log(`Server http://localhost:${port}${ui}`);
});

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getDb } from "./db";
import { stateRoutes } from "./routes/state";
import { instrumentsRoutes } from "./routes/instruments";
import { portfolioRoutes } from "./routes/portfolio";
import { quotesRoutes } from "./routes/quotes";
import { settingsRoutes } from "./routes/settings";

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

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 5174);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API http://localhost:${port}`);
});

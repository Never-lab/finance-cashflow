import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getDb } from "./db";
import { stateRoutes } from "./routes/state";
import { instrumentsRoutes } from "./routes/instruments";
import { portfolioRoutes } from "./routes/portfolio";

getDb(); // ensure migrate on boot

const app = new Hono();
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api", stateRoutes);
app.route("/api", instrumentsRoutes);
app.route("/api", portfolioRoutes);

const port = Number(process.env.API_PORT ?? 5174);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API http://localhost:${port}`);
});

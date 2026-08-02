import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getDb } from "./db";
import { stateRoutes } from "./routes/state";

getDb(); // ensure migrate on boot

const app = new Hono();
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api", stateRoutes);

const port = Number(process.env.API_PORT ?? 5174);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API http://localhost:${port}`);
});

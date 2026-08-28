import { serve } from "@hono/node-server";
import fs from "node:fs";
import path from "node:path";
import { createApp, DIST_DIR } from "./app";
import { getDb } from "./db";

getDb(); // ensure migrate + auth seed on boot

const app = createApp();

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 5174);
serve({ fetch: app.fetch, port }, () => {
  const ui = fs.existsSync(path.join(DIST_DIR, "index.html")) ? " + UI" : "";
  const auth = process.env.FINANCE_AUTH === "on" ? " + auth" : "";
  console.log(`Server http://localhost:${port}${ui}${auth}`);
});

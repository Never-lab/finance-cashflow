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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
export const DIST_DIR = path.join(ROOT, "dist");

export function createApp(): Hono {
  const app = new Hono();

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

    app.notFound((c) => {
      if (c.req.path.startsWith("/api")) {
        return c.json({ error: "Not found" }, 404);
      }
      c.header("Cache-Control", "no-cache");
      return serveStatic({ root: DIST_DIR, path: "index.html" })(c, () =>
        c.text("Not Found", 404),
      );
    });
  }

  return app;
}

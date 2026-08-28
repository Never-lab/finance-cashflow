import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app";
import { openDb, migrate, resetDbForTests } from "./db";
import { resetLoginRateLimitForTests } from "./lib/loginRateLimit";

describe("auth API", () => {
  let dir: string;
  let prev: NodeJS.ProcessEnv;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "fin-auth-"));
    prev = { ...process.env };
    resetDbForTests();
    resetLoginRateLimitForTests();
    process.env.FINANCE_AUTH = "on";
    process.env.FINANCE_SECRET = "integration-test-secret-key-32b";
    process.env.FINANCE_USERNAME = "nicholas";
    process.env.FINANCE_PASSWORD = "secret1234";
    process.env.DATABASE_PATH = path.join(dir, "t.db");
    const db = openDb(process.env.DATABASE_PATH);
    migrate(db);
    db.close();
  });

  afterEach(() => {
    resetDbForTests();
    resetLoginRateLimitForTests();
    process.env = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("GET /api/state requires auth when FINANCE_AUTH=on", async () => {
    const app = createApp();
    const res = await app.request("/api/state");
    expect(res.status).toBe(401);
  });

  it("login + me + state flow", async () => {
    const app = createApp();

    const bad = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nicholas", password: "wrong" }),
    });
    expect(bad.status).toBe(401);

    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nicholas", password: "secret1234" }),
    });
    expect(login.status).toBe(200);
    const { token } = (await login.json()) as { token: string };
    expect(token.length).toBeGreaterThan(10);

    const state = await app.request("/api/state", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(state.status).toBe(200);

    const me = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as { username: string };
    expect(meBody.username).toBe("nicholas");
  });
});

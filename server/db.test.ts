import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, migrate } from "./db";

describe("sqlite schema", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "fin-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("creates core tables", () => {
    const db = openDb(path.join(dir, "t.db"));
    migrate(db);
    const names = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all()
      .map((r: { name: string }) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "transactions",
        "category_overrides",
        "recurring_marks",
        "internal_overrides",
        "instruments",
        "holdings",
        "contributions",
        "quotes_cache",
        "settings",
      ]),
    );
    db.close();
  });
});

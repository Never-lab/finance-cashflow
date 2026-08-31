import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedAuthUser } from "./lib/authUser";
import { runMigrations } from "./lib/migrations";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEFAULT_DB = path.join(ROOT, "data", "finance.db");

export function resolveDbPath(): string {
  return process.env.DATABASE_PATH?.trim() || DEFAULT_DB;
}

export function openDb(dbPath: string = DEFAULT_DB): Database.Database {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function migrate(db: Database.Database): void {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(sql);
  runMigrations(db);
  seedAuthUser(db);
}

let singleton: Database.Database | null = null;

export function resetDbForTests(): void {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
}

export function getDb(): Database.Database {
  if (!singleton) {
    singleton = openDb(resolveDbPath());
    migrate(singleton);
  }
  return singleton;
}

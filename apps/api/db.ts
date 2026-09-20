/**
 * Accesso SQLite (better-sqlite3): path, apertura, migrazione schema, singleton runtime.
 * Ruolo: repo layer di basso livello — legge schema.sql, invoca migrations e seed auth.
 * Tabelle: tutte quelle definite in schema.sql (transactions, instruments, quotes_cache, auth_user, …).
 * Path resolution:
 *   - __dirname = directory di questo modulo (apps/api a runtime);
 *   - ROOT = join(__dirname, "../..") → radice monorepo;
 *   - DEFAULT_DB = ROOT/data/finance.db;
 *   - DATABASE_PATH (env) sovrascrive il file DB; valore speciale `:memory:` per test senza cartella.
 * Privacy: il DB contiene movimenti bancari, cedolini, hash password; va protetto a livello filesystem/backup.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedAuthUser } from "./lib/authUser";
import { runMigrations } from "./lib/migrations";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const DEFAULT_DB = path.join(ROOT, "data", "finance.db");

/**
 * Percorso effettivo del database: env DATABASE_PATH o default sotto `data/finance.db`.
 */
export function resolveDbPath(): string {
  return process.env.DATABASE_PATH?.trim() || DEFAULT_DB;
}

/**
 * Apre una connessione SQLite con WAL e foreign keys.
 * @param dbPath — file, `:memory:` o path da {@link resolveDbPath}.
 */
export function openDb(dbPath: string = DEFAULT_DB): Database.Database {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

/**
 * Applica schema.sql, migrazioni incrementali e seed utente auth da variabili d'ambiente.
 */
export function migrate(db: Database.Database): void {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(sql);
  runMigrations(db);
  seedAuthUser(db);
}

let singleton: Database.Database | null = null;

/** Chiude il singleton (solo test). */
export function resetDbForTests(): void {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
}

/**
 * Restituisce l'unica istanza DB del processo, creandola e migrando al primo accesso.
 */
export function getDb(): Database.Database {
  if (!singleton) {
    singleton = openDb(resolveDbPath());
    migrate(singleton);
  }
  return singleton;
}

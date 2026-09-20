/**
 * Accesso tabella auth_user: lookup, registrazione, seed da env.
 * Ruolo: auth/repo — tabella auth_user.
 * Privacy: password_hash only; seed opzionale da FINANCE_USERNAME/FINANCE_PASSWORD al primo avvio.
 */
import type Database from "better-sqlite3";
import { hashPassword, MIN_PASSWORD_LEN } from "./authPassword";
import { isAuthEnabled } from "./authSession";

export type AuthUserRow = {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
};

/** Utente per id numerico. */
export function getAuthUserById(db: Database.Database, id: number): AuthUserRow | undefined {
  return db
    .prepare("SELECT id, username, password_hash, created_at FROM auth_user WHERE id = ?")
    .get(id) as AuthUserRow | undefined;
}

/** Utente per username (case-insensitive). */
export function getAuthUserByUsername(
  db: Database.Database,
  username: string,
): AuthUserRow | undefined {
  return db
    .prepare(
      "SELECT id, username, password_hash, created_at FROM auth_user WHERE username = ? COLLATE NOCASE",
    )
    .get(username.trim()) as AuthUserRow | undefined;
}

/** Crea utente; errore se username già presente o password troppo corta. */
export function createAuthUser(
  db: Database.Database,
  username: string,
  password: string,
): AuthUserRow {
  const trimmed = username.trim();
  if (!trimmed) throw new Error("Username required");
  if (password.length < MIN_PASSWORD_LEN) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LEN} characters`);
  }
  if (getAuthUserByUsername(db, trimmed)) {
    throw new Error("Username already taken");
  }

  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      "INSERT INTO auth_user (username, password_hash, created_at) VALUES (?, ?, ?)",
    )
    .run(trimmed, hashPassword(password), createdAt);

  return getAuthUserById(db, Number(result.lastInsertRowid))!;
}

/**
 * Se auth abilitata e DB vuoto, crea utente da FINANCE_USERNAME e FINANCE_PASSWORD.
 */
export function seedAuthUser(db: Database.Database): void {
  if (!isAuthEnabled()) return;
  if (db.prepare("SELECT 1 FROM auth_user LIMIT 1").get()) return;

  const username = process.env.FINANCE_USERNAME?.trim();
  const password = process.env.FINANCE_PASSWORD ?? "";
  if (!username || password.length < MIN_PASSWORD_LEN) return;

  createAuthUser(db, username, password);
}

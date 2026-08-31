import type Database from "better-sqlite3";
import { hashPassword, MIN_PASSWORD_LEN } from "./authPassword";
import { isAuthEnabled } from "./authSession";

export type AuthUserRow = {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
};

export function getAuthUserById(db: Database.Database, id: number): AuthUserRow | undefined {
  return db
    .prepare("SELECT id, username, password_hash, created_at FROM auth_user WHERE id = ?")
    .get(id) as AuthUserRow | undefined;
}

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

export function seedAuthUser(db: Database.Database): void {
  if (!isAuthEnabled()) return;
  if (db.prepare("SELECT 1 FROM auth_user LIMIT 1").get()) return;

  const username = process.env.FINANCE_USERNAME?.trim();
  const password = process.env.FINANCE_PASSWORD ?? "";
  if (!username || password.length < MIN_PASSWORD_LEN) return;

  createAuthUser(db, username, password);
}

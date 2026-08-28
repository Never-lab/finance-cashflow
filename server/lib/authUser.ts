import type Database from "better-sqlite3";
import { hashPassword, MIN_PASSWORD_LEN } from "./authPassword";
import { isAuthEnabled } from "./authSession";

export type AuthUserRow = {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
};

export function getAuthUser(db: Database.Database): AuthUserRow | undefined {
  return db.prepare("SELECT id, username, password_hash, created_at FROM auth_user WHERE id = 1").get() as
    | AuthUserRow
    | undefined;
}

export function seedAuthUser(db: Database.Database): void {
  if (!isAuthEnabled()) return;
  if (getAuthUser(db)) return;

  const username = process.env.FINANCE_USERNAME?.trim();
  const password = process.env.FINANCE_PASSWORD ?? "";
  if (!username || password.length < MIN_PASSWORD_LEN) {
    throw new Error(
      "FINANCE_AUTH=on requires FINANCE_USERNAME and FINANCE_PASSWORD (min 8 chars) when no user exists",
    );
  }

  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO auth_user (id, username, password_hash, created_at) VALUES (1, ?, ?, ?)",
  ).run(username, hashPassword(password), createdAt);
}

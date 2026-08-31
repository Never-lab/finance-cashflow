import type Database from "better-sqlite3";

export function getSetting(db: Database.Database, userId: number, key: string): string | null {
  const row = db
    .prepare(`SELECT value FROM settings WHERE user_id = ? AND key = ?`)
    .get(userId, key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(
  db: Database.Database,
  userId: number,
  key: string,
  value: string,
): void {
  db.prepare(
    `INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
  ).run(userId, key, value);
}

export function deleteSetting(db: Database.Database, userId: number, key: string): void {
  db.prepare(`DELETE FROM settings WHERE user_id = ? AND key = ?`).run(userId, key);
}

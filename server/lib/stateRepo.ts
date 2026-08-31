import type Database from "better-sqlite3";
import type { AppState, RecurringMark, Transaction } from "../../src/types";

type TxRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  source: string;
  category: string;
  internal: number | null;
};

function rowToTransaction(row: TxRow): Transaction {
  const t: Transaction = {
    id: row.id,
    date: row.date,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    source: row.source as Transaction["source"],
    category: row.category,
  };
  if (row.internal !== null) t.internal = row.internal === 1;
  return t;
}

function toInternalCol(internal: boolean | undefined): number | null {
  return internal === undefined ? null : internal ? 1 : 0;
}

export function loadAppState(db: Database.Database, userId: number): AppState {
  const rows = db
    .prepare(
      `SELECT id, date, description, amount, currency, source, category, internal
       FROM transactions WHERE user_id = ? ORDER BY date DESC`,
    )
    .all(userId) as TxRow[];

  const categoryOverrides: Record<string, string> = {};
  for (const r of db
    .prepare(`SELECT transaction_id, category FROM category_overrides WHERE user_id = ?`)
    .all(userId) as { transaction_id: string; category: string }[]) {
    categoryOverrides[r.transaction_id] = r.category;
  }

  const recurringMarks: Record<string, RecurringMark> = {};
  for (const r of db
    .prepare(`SELECT transaction_id, mark FROM recurring_marks WHERE user_id = ?`)
    .all(userId) as { transaction_id: string; mark: string }[]) {
    recurringMarks[r.transaction_id] = r.mark as RecurringMark;
  }

  const internalOverrides: Record<string, boolean> = {};
  for (const r of db
    .prepare(`SELECT transaction_id, internal FROM internal_overrides WHERE user_id = ?`)
    .all(userId) as { transaction_id: string; internal: number }[]) {
    internalOverrides[r.transaction_id] = r.internal === 1;
  }

  return {
    transactions: rows.map(rowToTransaction),
    categoryOverrides,
    recurringMarks,
    internalOverrides,
  };
}

/** Clears and re-inserts every state table inside one transaction. */
export function replaceAppState(db: Database.Database, userId: number, state: AppState): void {
  const insertTx = db.prepare(
    `INSERT INTO transactions (user_id, id, date, description, amount, currency, source, category, internal)
     VALUES (@userId, @id, @date, @description, @amount, @currency, @source, @category, @internal)`,
  );
  const insertCat = db.prepare(
    `INSERT INTO category_overrides (user_id, transaction_id, category) VALUES (?, ?, ?)`,
  );
  const insertMark = db.prepare(
    `INSERT INTO recurring_marks (user_id, transaction_id, mark) VALUES (?, ?, ?)`,
  );
  const insertInternal = db.prepare(
    `INSERT INTO internal_overrides (user_id, transaction_id, internal) VALUES (?, ?, ?)`,
  );

  const run = db.transaction((s: AppState) => {
    db.prepare(`DELETE FROM category_overrides WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM recurring_marks WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM internal_overrides WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM transactions WHERE user_id = ?`).run(userId);

    for (const t of s.transactions) {
      insertTx.run({
        userId,
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        currency: t.currency,
        source: t.source,
        category: t.category,
        internal: toInternalCol(t.internal),
      });
    }
    for (const [id, category] of Object.entries(s.categoryOverrides)) {
      insertCat.run(userId, id, category);
    }
    for (const [key, mark] of Object.entries(s.recurringMarks)) {
      if (mark) insertMark.run(userId, key, mark);
    }
    for (const [id, internal] of Object.entries(s.internalOverrides)) {
      insertInternal.run(userId, id, internal ? 1 : 0);
    }
  });

  run(state);
}

/** Upsert by id, mirroring src/lib/appState mergeImport semantics. Overrides untouched. */
export function mergeImportIntoDb(
  db: Database.Database,
  userId: number,
  rows: Transaction[],
): { added: number; updated: number } {
  const existing = db.prepare(`SELECT 1 FROM transactions WHERE user_id = ? AND id = ?`);
  const insert = db.prepare(
    `INSERT INTO transactions (user_id, id, date, description, amount, currency, source, category, internal)
     VALUES (@userId, @id, @date, @description, @amount, @currency, @source, @category, @internal)`,
  );
  const update = db.prepare(
    `UPDATE transactions
     SET date=@date, description=@description, amount=@amount, currency=@currency,
         source=@source, category=@category, internal=@internal
     WHERE user_id=@userId AND id=@id`,
  );

  let added = 0;
  let updated = 0;

  const run = db.transaction((incoming: Transaction[]) => {
    for (const row of incoming) {
      const params = {
        userId,
        id: row.id,
        date: row.date,
        description: row.description,
        amount: row.amount,
        currency: row.currency,
        source: row.source,
        category: row.category,
        internal: toInternalCol(row.internal),
      };
      if (existing.get(userId, row.id)) {
        update.run(params);
        updated++;
      } else {
        insert.run(params);
        added++;
      }
    }
  });

  run(rows);
  return { added, updated };
}

export function setCategoryOverrideDb(
  db: Database.Database,
  userId: number,
  id: string,
  category: string,
): void {
  db.prepare(
    `INSERT INTO category_overrides (user_id, transaction_id, category) VALUES (?, ?, ?)
     ON CONFLICT(user_id, transaction_id) DO UPDATE SET category = excluded.category`,
  ).run(userId, id, category);
}

export function setCategoryOverridesBulkDb(
  db: Database.Database,
  userId: number,
  ids: string[],
  category: string,
): void {
  const stmt = db.prepare(
    `INSERT INTO category_overrides (user_id, transaction_id, category) VALUES (?, ?, ?)
     ON CONFLICT(user_id, transaction_id) DO UPDATE SET category = excluded.category`,
  );
  const run = db.transaction((rows: string[]) => {
    for (const id of rows) stmt.run(userId, id, category);
  });
  run(ids);
}

export function setInternalOverrideDb(
  db: Database.Database,
  userId: number,
  id: string,
  internal: boolean,
): void {
  db.prepare(
    `INSERT INTO internal_overrides (user_id, transaction_id, internal) VALUES (?, ?, ?)
     ON CONFLICT(user_id, transaction_id) DO UPDATE SET internal = excluded.internal`,
  ).run(userId, id, internal ? 1 : 0);
}

export function setRecurringMarkDb(
  db: Database.Database,
  userId: number,
  key: string,
  mark: RecurringMark,
): void {
  if (!mark) {
    db.prepare(`DELETE FROM recurring_marks WHERE user_id = ? AND transaction_id = ?`).run(
      userId,
      key,
    );
    return;
  }
  db.prepare(
    `INSERT INTO recurring_marks (user_id, transaction_id, mark) VALUES (?, ?, ?)
     ON CONFLICT(user_id, transaction_id) DO UPDATE SET mark = excluded.mark`,
  ).run(userId, key, mark);
}

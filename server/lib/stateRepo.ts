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

export function loadAppState(db: Database.Database): AppState {
  const rows = db
    .prepare(
      `SELECT id, date, description, amount, currency, source, category, internal
       FROM transactions ORDER BY date DESC`,
    )
    .all() as TxRow[];

  const categoryOverrides: Record<string, string> = {};
  for (const r of db
    .prepare(`SELECT transaction_id, category FROM category_overrides`)
    .all() as { transaction_id: string; category: string }[]) {
    categoryOverrides[r.transaction_id] = r.category;
  }

  const recurringMarks: Record<string, RecurringMark> = {};
  for (const r of db
    .prepare(`SELECT transaction_id, mark FROM recurring_marks`)
    .all() as { transaction_id: string; mark: string }[]) {
    recurringMarks[r.transaction_id] = r.mark as RecurringMark;
  }

  const internalOverrides: Record<string, boolean> = {};
  for (const r of db
    .prepare(`SELECT transaction_id, internal FROM internal_overrides`)
    .all() as { transaction_id: string; internal: number }[]) {
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
export function replaceAppState(db: Database.Database, state: AppState): void {
  const insertTx = db.prepare(
    `INSERT INTO transactions (id, date, description, amount, currency, source, category, internal)
     VALUES (@id, @date, @description, @amount, @currency, @source, @category, @internal)`,
  );
  const insertCat = db.prepare(
    `INSERT INTO category_overrides (transaction_id, category) VALUES (?, ?)`,
  );
  const insertMark = db.prepare(
    `INSERT INTO recurring_marks (transaction_id, mark) VALUES (?, ?)`,
  );
  const insertInternal = db.prepare(
    `INSERT INTO internal_overrides (transaction_id, internal) VALUES (?, ?)`,
  );

  const run = db.transaction((s: AppState) => {
    db.exec(
      `DELETE FROM transactions; DELETE FROM category_overrides; DELETE FROM recurring_marks; DELETE FROM internal_overrides;`,
    );

    for (const t of s.transactions) {
      insertTx.run({
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
      insertCat.run(id, category);
    }
    for (const [key, mark] of Object.entries(s.recurringMarks)) {
      if (mark) insertMark.run(key, mark);
    }
    for (const [id, internal] of Object.entries(s.internalOverrides)) {
      insertInternal.run(id, internal ? 1 : 0);
    }
  });

  run(state);
}

/** Upsert by id, mirroring src/lib/appState mergeImport semantics. Overrides untouched. */
export function mergeImportIntoDb(
  db: Database.Database,
  rows: Transaction[],
): { added: number; updated: number } {
  const existing = db.prepare(`SELECT 1 FROM transactions WHERE id = ?`);
  const insert = db.prepare(
    `INSERT INTO transactions (id, date, description, amount, currency, source, category, internal)
     VALUES (@id, @date, @description, @amount, @currency, @source, @category, @internal)`,
  );
  const update = db.prepare(
    `UPDATE transactions
     SET date=@date, description=@description, amount=@amount, currency=@currency,
         source=@source, category=@category, internal=@internal
     WHERE id=@id`,
  );

  let added = 0;
  let updated = 0;

  const run = db.transaction((incoming: Transaction[]) => {
    for (const row of incoming) {
      const params = {
        id: row.id,
        date: row.date,
        description: row.description,
        amount: row.amount,
        currency: row.currency,
        source: row.source,
        category: row.category,
        internal: toInternalCol(row.internal),
      };
      if (existing.get(row.id)) {
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

export function setCategoryOverrideDb(db: Database.Database, id: string, category: string): void {
  db.prepare(
    `INSERT INTO category_overrides (transaction_id, category) VALUES (?, ?)
     ON CONFLICT(transaction_id) DO UPDATE SET category = excluded.category`,
  ).run(id, category);
}

export function setCategoryOverridesBulkDb(
  db: Database.Database,
  ids: string[],
  category: string,
): void {
  const stmt = db.prepare(
    `INSERT INTO category_overrides (transaction_id, category) VALUES (?, ?)
     ON CONFLICT(transaction_id) DO UPDATE SET category = excluded.category`,
  );
  const run = db.transaction((rows: string[]) => {
    for (const id of rows) stmt.run(id, category);
  });
  run(ids);
}

export function setInternalOverrideDb(
  db: Database.Database,
  id: string,
  internal: boolean,
): void {
  db.prepare(
    `INSERT INTO internal_overrides (transaction_id, internal) VALUES (?, ?)
     ON CONFLICT(transaction_id) DO UPDATE SET internal = excluded.internal`,
  ).run(id, internal ? 1 : 0);
}

export function setRecurringMarkDb(db: Database.Database, key: string, mark: RecurringMark): void {
  if (!mark) {
    db.prepare(`DELETE FROM recurring_marks WHERE transaction_id = ?`).run(key);
    return;
  }
  db.prepare(
    `INSERT INTO recurring_marks (transaction_id, mark) VALUES (?, ?)
     ON CONFLICT(transaction_id) DO UPDATE SET mark = excluded.mark`,
  ).run(key, mark);
}

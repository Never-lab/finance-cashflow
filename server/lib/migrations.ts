import type Database from "better-sqlite3";
import { hashPassword } from "./authPassword";
import { isAuthEnabled } from "./authSession";

const LEGACY_USER_ID = 1;

function hasUserIdColumn(db: Database.Database, table: string): boolean {
  const cols = db.pragma(`table_info(${table})`) as { name: string }[];
  return cols.some((c) => c.name === "user_id");
}

function migrateAuthUser(db: Database.Database): void {
  const cols = db.pragma("table_info(auth_user)") as { name: string }[];
  if (cols.length === 0) return;

  const idCol = cols.find((c) => c.name === "id");
  const sql = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='auth_user'`)
    .get() as { sql: string } | undefined;
  if (!sql?.sql.includes("CHECK (id = 1)")) return;

  db.exec(`
    CREATE TABLE auth_user_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    INSERT INTO auth_user_new (id, username, password_hash, created_at)
      SELECT id, username, password_hash, created_at FROM auth_user;
    DROP TABLE auth_user;
    ALTER TABLE auth_user_new RENAME TO auth_user;
  `);
}

function migrateTable(
  db: Database.Database,
  table: string,
  createSql: string,
  insertSql: string,
): void {
  if (hasUserIdColumn(db, table)) return;
  db.exec(createSql);
  db.exec(insertSql);
  db.exec(`DROP TABLE ${table}`);
  db.exec(`ALTER TABLE ${table}_new RENAME TO ${table}`);
}

function migrateToMultiUser(db: Database.Database): void {
  if (hasUserIdColumn(db, "transactions")) return;

  migrateAuthUser(db);

  migrateTable(
    db,
    "transactions",
    `CREATE TABLE transactions_new (
      user_id INTEGER NOT NULL DEFAULT ${LEGACY_USER_ID},
      id TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      source TEXT NOT NULL,
      category TEXT NOT NULL,
      internal INTEGER,
      PRIMARY KEY (user_id, id)
    )`,
    `INSERT INTO transactions_new (user_id, id, date, description, amount, currency, source, category, internal)
     SELECT ${LEGACY_USER_ID}, id, date, description, amount, currency, source, category, internal FROM transactions`,
  );

  migrateTable(
    db,
    "category_overrides",
    `CREATE TABLE category_overrides_new (
      user_id INTEGER NOT NULL DEFAULT ${LEGACY_USER_ID},
      transaction_id TEXT NOT NULL,
      category TEXT NOT NULL,
      PRIMARY KEY (user_id, transaction_id)
    )`,
    `INSERT INTO category_overrides_new (user_id, transaction_id, category)
     SELECT ${LEGACY_USER_ID}, transaction_id, category FROM category_overrides`,
  );

  migrateTable(
    db,
    "recurring_marks",
    `CREATE TABLE recurring_marks_new (
      user_id INTEGER NOT NULL DEFAULT ${LEGACY_USER_ID},
      transaction_id TEXT NOT NULL,
      mark TEXT NOT NULL,
      PRIMARY KEY (user_id, transaction_id)
    )`,
    `INSERT INTO recurring_marks_new (user_id, transaction_id, mark)
     SELECT ${LEGACY_USER_ID}, transaction_id, mark FROM recurring_marks`,
  );

  migrateTable(
    db,
    "internal_overrides",
    `CREATE TABLE internal_overrides_new (
      user_id INTEGER NOT NULL DEFAULT ${LEGACY_USER_ID},
      transaction_id TEXT NOT NULL,
      internal INTEGER NOT NULL,
      PRIMARY KEY (user_id, transaction_id)
    )`,
    `INSERT INTO internal_overrides_new (user_id, transaction_id, internal)
     SELECT ${LEGACY_USER_ID}, transaction_id, internal FROM internal_overrides`,
  );

  migrateTable(
    db,
    "instruments",
    `CREATE TABLE instruments_new (
      user_id INTEGER NOT NULL DEFAULT ${LEGACY_USER_ID},
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      ticker TEXT,
      isin TEXT,
      currency TEXT NOT NULL DEFAULT 'EUR',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    )`,
    `INSERT INTO instruments_new (user_id, id, name, type, ticker, isin, currency, notes, created_at, updated_at)
     SELECT ${LEGACY_USER_ID}, id, name, type, ticker, isin, currency, notes, created_at, updated_at FROM instruments`,
  );

  migrateTable(
    db,
    "holdings",
    `CREATE TABLE holdings_new (
      user_id INTEGER NOT NULL DEFAULT ${LEGACY_USER_ID},
      instrument_id TEXT NOT NULL,
      quantity REAL,
      cash_balance REAL,
      cost_basis REAL NOT NULL DEFAULT 0,
      as_of TEXT,
      PRIMARY KEY (user_id, instrument_id)
    )`,
    `INSERT INTO holdings_new (user_id, instrument_id, quantity, cash_balance, cost_basis, as_of)
     SELECT ${LEGACY_USER_ID}, instrument_id, quantity, cash_balance, cost_basis, as_of FROM holdings`,
  );

  migrateTable(
    db,
    "contributions",
    `CREATE TABLE contributions_new (
      user_id INTEGER NOT NULL DEFAULT ${LEGACY_USER_ID},
      id TEXT NOT NULL,
      instrument_id TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      transaction_id TEXT,
      note TEXT,
      PRIMARY KEY (user_id, id)
    )`,
    `INSERT INTO contributions_new (user_id, id, instrument_id, date, amount, transaction_id, note)
     SELECT ${LEGACY_USER_ID}, id, instrument_id, date, amount, transaction_id, note FROM contributions`,
  );

  migrateTable(
    db,
    "settings",
    `CREATE TABLE settings_new (
      user_id INTEGER NOT NULL DEFAULT ${LEGACY_USER_ID},
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    )`,
    `INSERT INTO settings_new (user_id, key, value)
     SELECT ${LEGACY_USER_ID}, key, value FROM settings`,
  );

  const payslipTables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='payslips'`)
    .get();
  if (payslipTables) {
    migrateTable(
      db,
      "payslips",
      `CREATE TABLE payslips_new (
        user_id INTEGER NOT NULL DEFAULT ${LEGACY_USER_ID},
        id TEXT NOT NULL,
        period_year INTEGER NOT NULL,
        period_month INTEGER NOT NULL,
        period_label TEXT NOT NULL,
        pay_date TEXT,
        gross_total REAL,
        taxable_income REAL,
        tax_withheld REAL,
        tax_withheld_net REAL,
        social_withheld REAL,
        net_to_account REAL,
        total_competenze REAL,
        net_pay REAL,
        bank_credit REAL,
        leave_fest_s REAL,
        leave_fest_g REAL,
        leave_fest_r REAL,
        leave_ferie_s REAL,
        leave_ferie_g REAL,
        leave_ferie_r REAL,
        leave_perm_s REAL,
        leave_perm_g REAL,
        leave_perm_r REAL,
        source_file TEXT,
        imported_at TEXT NOT NULL,
        parser_version TEXT NOT NULL,
        PRIMARY KEY (user_id, id)
      )`,
      `INSERT INTO payslips_new (
        user_id, id, period_year, period_month, period_label, pay_date,
        gross_total, taxable_income, tax_withheld, tax_withheld_net, social_withheld,
        net_to_account, total_competenze, net_pay, bank_credit,
        leave_fest_s, leave_fest_g, leave_fest_r,
        leave_ferie_s, leave_ferie_g, leave_ferie_r,
        leave_perm_s, leave_perm_g, leave_perm_r,
        source_file, imported_at, parser_version
      )
      SELECT
        ${LEGACY_USER_ID}, id, period_year, period_month, period_label, pay_date,
        gross_total, taxable_income, tax_withheld, tax_withheld_net, social_withheld,
        net_to_account, total_competenze, net_pay, bank_credit,
        leave_fest_s, leave_fest_g, leave_fest_r,
        leave_ferie_s, leave_ferie_g, leave_ferie_r,
        leave_perm_s, leave_perm_g, leave_perm_r,
        source_file, imported_at, parser_version
      FROM payslips`,
    );
  }
}

/** Local dev / tests: ensure user id 1 exists for FK when auth is off. */
export function ensureBootstrapUser(db: Database.Database): void {
  if (isAuthEnabled()) return;
  const row = db.prepare(`SELECT id FROM auth_user ORDER BY id LIMIT 1`).get() as
    | { id: number }
    | undefined;
  if (row) return;
  db.prepare(
    `INSERT INTO auth_user (username, password_hash, created_at) VALUES (?, ?, ?)`,
  ).run("local", hashPassword(crypto.randomUUID()), new Date().toISOString());
}

export function runMigrations(db: Database.Database): void {
  migrateToMultiUser(db);
  ensureBootstrapUser(db);
}

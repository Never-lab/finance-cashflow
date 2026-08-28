CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  internal INTEGER
);

CREATE TABLE IF NOT EXISTS category_overrides (
  transaction_id TEXT PRIMARY KEY,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_marks (
  transaction_id TEXT PRIMARY KEY,
  mark TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS internal_overrides (
  transaction_id TEXT PRIMARY KEY,
  internal INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS instruments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  ticker TEXT,
  isin TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS holdings (
  instrument_id TEXT PRIMARY KEY REFERENCES instruments(id) ON DELETE CASCADE,
  quantity REAL,
  cash_balance REAL,
  cost_basis REAL NOT NULL DEFAULT 0,
  as_of TEXT
);

CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY,
  instrument_id TEXT NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  transaction_id TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS quotes_cache (
  ticker TEXT NOT NULL,
  as_of TEXT NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (ticker, as_of)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_user (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payslips (
  id TEXT PRIMARY KEY,
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
  parser_version TEXT NOT NULL
);

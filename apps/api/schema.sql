-- Schema SQLite iniziale per l'API finance (apps/api).
-- Tabelle per utenti auth, movimenti, override, strumenti, cache quotazioni, cedolini, settings.
-- I dati sono per-utente (user_id) dove applicabile; FK con ON DELETE CASCADE su auth_user.

CREATE TABLE IF NOT EXISTS auth_user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  user_id INTEGER NOT NULL,
  id TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  internal INTEGER,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS category_overrides (
  user_id INTEGER NOT NULL,
  transaction_id TEXT NOT NULL,
  category TEXT NOT NULL,
  PRIMARY KEY (user_id, transaction_id),
  FOREIGN KEY (user_id, transaction_id) REFERENCES transactions(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recurring_marks (
  user_id INTEGER NOT NULL,
  transaction_id TEXT NOT NULL,
  mark TEXT NOT NULL,
  PRIMARY KEY (user_id, transaction_id),
  FOREIGN KEY (user_id, transaction_id) REFERENCES transactions(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS internal_overrides (
  user_id INTEGER NOT NULL,
  transaction_id TEXT NOT NULL,
  internal INTEGER NOT NULL,
  PRIMARY KEY (user_id, transaction_id),
  FOREIGN KEY (user_id, transaction_id) REFERENCES transactions(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS instruments (
  user_id INTEGER NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  ticker TEXT,
  isin TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS holdings (
  user_id INTEGER NOT NULL,
  instrument_id TEXT NOT NULL,
  quantity REAL,
  cash_balance REAL,
  cost_basis REAL NOT NULL DEFAULT 0,
  as_of TEXT,
  PRIMARY KEY (user_id, instrument_id),
  FOREIGN KEY (user_id, instrument_id) REFERENCES instruments(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contributions (
  user_id INTEGER NOT NULL,
  id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  transaction_id TEXT,
  note TEXT,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, instrument_id) REFERENCES instruments(user_id, id) ON DELETE CASCADE
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
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, key),
  FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payslips (
  user_id INTEGER NOT NULL,
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
  payslip_net REAL,
  net_pay REAL,
  bank_credit REAL,
  bank_match_status TEXT,
  acc_anomalous INTEGER NOT NULL DEFAULT 0,
  leave_fest_ap_s REAL,
  leave_fest_ap_g REAL,
  leave_fest_ap_r REAL,
  leave_fest_ac_s REAL,
  leave_fest_ac_g REAL,
  leave_fest_ac_r REAL,
  leave_fest_s REAL,
  leave_fest_g REAL,
  leave_fest_r REAL,
  leave_ferie_ap_s REAL,
  leave_ferie_ap_g REAL,
  leave_ferie_ap_r REAL,
  leave_ferie_ac_s REAL,
  leave_ferie_ac_g REAL,
  leave_ferie_ac_r REAL,
  leave_ferie_s REAL,
  leave_ferie_g REAL,
  leave_ferie_r REAL,
  leave_perm_ap_s REAL,
  leave_perm_ap_g REAL,
  leave_perm_ap_r REAL,
  leave_perm_ac_s REAL,
  leave_perm_ac_g REAL,
  leave_perm_ac_r REAL,
  leave_perm_s REAL,
  leave_perm_g REAL,
  leave_perm_r REAL,
  source_file TEXT,
  imported_at TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE
);

-- Open Banking links (GoCardless Bank Account Data). One row per user+bank source.
CREATE TABLE IF NOT EXISTS bank_links (
  user_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  requisition_id TEXT,
  reference TEXT NOT NULL,
  institution_id TEXT,
  account_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  consent_expires_at TEXT,
  last_sync_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, source),
  FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_links_reference ON bank_links(reference);

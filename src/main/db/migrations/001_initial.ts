import type { Migration } from '../migrate'

// Conventions (docs/PLAN.md §1): money is INTEGER cents, dates are 'YYYY-MM-DD' TEXT,
// timestamps are ISO-8601 UTC TEXT. Tables are STRICT so SQLite rejects wrongly typed values.

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
const isDate = (column: string): string =>
  `${column} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`
const isBool = (column: string): string => `${column} IN (0, 1)`

const sql = /* sql */ `
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL            -- JSON-encoded
) STRICT;

CREATE TABLE accounts (
  id              INTEGER PRIMARY KEY,
  name            TEXT    NOT NULL,
  type            TEXT    NOT NULL CHECK (type IN ('debit', 'credit', 'cash')),
  opening_balance INTEGER NOT NULL DEFAULT 0,   -- credit cards: starting debt as a negative number
  opening_date    TEXT    NOT NULL CHECK (${isDate('opening_date')}),
  credit_limit    INTEGER CHECK (credit_limit >= 0),
  statement_day   INTEGER CHECK (statement_day BETWEEN 1 AND 31),
  payment_due_day INTEGER CHECK (payment_due_day BETWEEN 1 AND 31),
  color           TEXT,
  icon            TEXT,
  is_archived     INTEGER NOT NULL DEFAULT 0 CHECK (${isBool('is_archived')}),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT ${NOW},
  CHECK (type = 'credit' OR (credit_limit IS NULL AND statement_day IS NULL AND payment_due_day IS NULL))
) STRICT;

CREATE TABLE categories (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL COLLATE NOCASE,
  type        TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
  color       TEXT,
  icon        TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (${isBool('is_archived')}),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (type, name)
) STRICT;

CREATE TABLE recurring_items (
  id                   INTEGER PRIMARY KEY,
  kind                 TEXT    NOT NULL CHECK (kind IN ('income', 'expense', 'subscription')),
  title                TEXT    NOT NULL,
  amount               INTEGER NOT NULL CHECK (amount > 0),
  account_id           INTEGER NOT NULL REFERENCES accounts (id),
  category_id          INTEGER NOT NULL REFERENCES categories (id),
  frequency            TEXT    NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  interval             INTEGER NOT NULL DEFAULT 1 CHECK (interval >= 1),
  anchor_date          TEXT    NOT NULL CHECK (${isDate('anchor_date')}),
  end_date             TEXT    CHECK (${isDate('end_date')}),
  next_due_date        TEXT    NOT NULL CHECK (${isDate('next_due_date')}),
  auto_post            INTEGER NOT NULL DEFAULT 0 CHECK (${isBool('auto_post')}),
  reminder_days_before INTEGER CHECK (reminder_days_before >= 0),
  url                  TEXT,
  note                 TEXT,
  is_active            INTEGER NOT NULL DEFAULT 1 CHECK (${isBool('is_active')}),
  created_at           TEXT    NOT NULL DEFAULT ${NOW},
  CHECK (end_date IS NULL OR end_date >= anchor_date)
) STRICT;

CREATE TABLE savings_goals (
  id              INTEGER PRIMARY KEY,
  name            TEXT    NOT NULL,
  target_amount   INTEGER NOT NULL CHECK (target_amount > 0),
  target_date     TEXT    CHECK (${isDate('target_date')}),
  starting_amount INTEGER NOT NULL DEFAULT 0 CHECK (starting_amount >= 0),
  planned_monthly INTEGER CHECK (planned_monthly >= 0),
  color           TEXT,
  icon            TEXT,
  is_archived     INTEGER NOT NULL DEFAULT 0 CHECK (${isBool('is_archived')}),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT ${NOW}
) STRICT;

CREATE TABLE loans (
  id                     INTEGER PRIMARY KEY,
  kind                   TEXT    NOT NULL CHECK (kind IN ('lent', 'borrowed', 'bank_loan')),
  title                  TEXT    NOT NULL,
  counterparty           TEXT    NOT NULL,
  principal              INTEGER NOT NULL CHECK (principal > 0),
  interest_rate          REAL    CHECK (interest_rate >= 0),     -- annual %
  start_date             TEXT    NOT NULL CHECK (${isDate('start_date')}),
  due_date               TEXT    CHECK (${isDate('due_date')}),
  installments_count     INTEGER CHECK (installments_count >= 1),
  payment_day            INTEGER CHECK (payment_day BETWEEN 1 AND 31),
  account_id             INTEGER REFERENCES accounts (id),
  create_disbursement_tx INTEGER NOT NULL DEFAULT 0 CHECK (${isBool('create_disbursement_tx')}),
  status                 TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'written_off')),
  note                   TEXT,
  created_at             TEXT    NOT NULL DEFAULT ${NOW}
) STRICT;

-- Paid status is derived from transactions.loan_installment_id (single source of truth).
CREATE TABLE loan_installments (
  id             INTEGER PRIMARY KEY,
  loan_id        INTEGER NOT NULL REFERENCES loans (id) ON DELETE CASCADE,
  seq            INTEGER NOT NULL CHECK (seq >= 1),
  due_date       TEXT    NOT NULL CHECK (${isDate('due_date')}),
  amount         INTEGER NOT NULL CHECK (amount > 0),
  principal_part INTEGER NOT NULL DEFAULT 0 CHECK (principal_part >= 0),
  interest_part  INTEGER NOT NULL DEFAULT 0 CHECK (interest_part >= 0),
  UNIQUE (loan_id, seq)
) STRICT;

-- Credit-card purchases split into N installments. The account must be a credit card
-- (enforced in the repository, since a CHECK cannot look at another table).
CREATE TABLE installment_plans (
  id                 INTEGER PRIMARY KEY,
  account_id         INTEGER NOT NULL REFERENCES accounts (id),
  title              TEXT    NOT NULL,
  category_id        INTEGER NOT NULL REFERENCES categories (id),
  total_amount       INTEGER NOT NULL CHECK (total_amount > 0),
  installments_count INTEGER NOT NULL CHECK (installments_count BETWEEN 2 AND 60),
  first_date         TEXT    NOT NULL CHECK (${isDate('first_date')}),
  fee_amount         INTEGER CHECK (fee_amount >= 0),
  note               TEXT,
  created_at         TEXT    NOT NULL DEFAULT ${NOW}
) STRICT;

-- The single ledger. amount is always positive; the sign comes from type (PLAN.md §2).
CREATE TABLE transactions (
  id                  INTEGER PRIMARY KEY,
  date                TEXT    NOT NULL CHECK (${isDate('date')}),
  title               TEXT    NOT NULL,
  amount              INTEGER NOT NULL CHECK (amount > 0),
  type                TEXT    NOT NULL CHECK (type IN (
                        'income', 'expense', 'transfer',
                        'savings_deposit', 'savings_withdrawal', 'loan_out', 'loan_in')),
  account_id          INTEGER NOT NULL REFERENCES accounts (id),
  to_account_id       INTEGER REFERENCES accounts (id),
  category_id         INTEGER REFERENCES categories (id),
  recurring_item_id   INTEGER REFERENCES recurring_items (id) ON DELETE SET NULL,
  savings_goal_id     INTEGER REFERENCES savings_goals (id),
  loan_id             INTEGER REFERENCES loans (id),
  loan_installment_id INTEGER REFERENCES loan_installments (id) ON DELETE SET NULL,
  installment_plan_id INTEGER REFERENCES installment_plans (id),
  planned_date        TEXT    CHECK (${isDate('planned_date')}),
  note                TEXT,
  created_at          TEXT    NOT NULL DEFAULT ${NOW},
  updated_at          TEXT    NOT NULL DEFAULT ${NOW},
  CHECK ((type = 'transfer') = (to_account_id IS NOT NULL)),
  CHECK (to_account_id IS NULL OR to_account_id <> account_id),
  CHECK (type NOT IN ('income', 'expense') OR category_id IS NOT NULL),
  CHECK (type IN ('income', 'expense') OR category_id IS NULL),
  CHECK ((type IN ('savings_deposit', 'savings_withdrawal')) = (savings_goal_id IS NOT NULL)),
  CHECK ((type IN ('loan_out', 'loan_in')) = (loan_id IS NOT NULL)),
  CHECK (loan_installment_id IS NULL OR loan_id IS NOT NULL),
  CHECK (planned_date IS NULL OR recurring_item_id IS NOT NULL
         OR installment_plan_id IS NOT NULL OR loan_installment_id IS NOT NULL)
) STRICT;

CREATE INDEX transactions_date          ON transactions (date);
CREATE INDEX transactions_account_date  ON transactions (account_id, date);
CREATE INDEX transactions_to_account    ON transactions (to_account_id) WHERE to_account_id IS NOT NULL;
CREATE INDEX transactions_category_date ON transactions (category_id, date);
CREATE INDEX transactions_type_date     ON transactions (type, date);
CREATE INDEX transactions_savings_goal  ON transactions (savings_goal_id) WHERE savings_goal_id IS NOT NULL;
CREATE INDEX transactions_loan          ON transactions (loan_id) WHERE loan_id IS NOT NULL;

-- A planned occurrence can be settled only once.
CREATE UNIQUE INDEX transactions_settles_recurring ON transactions (recurring_item_id, planned_date)
  WHERE recurring_item_id IS NOT NULL AND planned_date IS NOT NULL;
CREATE UNIQUE INDEX transactions_settles_plan ON transactions (installment_plan_id, planned_date)
  WHERE installment_plan_id IS NOT NULL AND planned_date IS NOT NULL;
CREATE UNIQUE INDEX transactions_settles_loan_installment ON transactions (loan_installment_id)
  WHERE loan_installment_id IS NOT NULL;

CREATE TRIGGER transactions_touch_updated_at
AFTER UPDATE ON transactions FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE transactions SET updated_at = ${NOW} WHERE id = NEW.id;
END;

CREATE INDEX recurring_items_next_due ON recurring_items (next_due_date) WHERE is_active = 1;
CREATE INDEX installment_plans_account ON installment_plans (account_id);
CREATE INDEX loan_installments_due ON loan_installments (due_date);

CREATE TABLE notification_log (
  id          INTEGER PRIMARY KEY,
  source_type TEXT    NOT NULL CHECK (source_type IN ('recurring', 'loan_installment', 'card_due', 'installment_plan')),
  source_id   INTEGER NOT NULL,
  due_date    TEXT    NOT NULL CHECK (${isDate('due_date')}),
  notified_at TEXT    NOT NULL DEFAULT ${NOW},
  UNIQUE (source_type, source_id, due_date)
) STRICT;
`

export const migration001: Migration = { version: 1, name: 'initial schema', sql }

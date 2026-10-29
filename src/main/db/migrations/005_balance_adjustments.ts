import type { Migration } from '../migrate'

// Balance adjustments (PLAN.md §2, step 39): two more transaction types for the difference
// between an account's balance in the app and the real one you typed. SQLite can't change a
// CHECK constraint, so `transactions` is rebuilt: create the new table, copy every row, drop
// the old one, rename, then recreate its indexes and trigger (dropping a table drops them).
// No table references `transactions`, so this is safe with foreign keys on.

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
const isDate = (column: string): string =>
  `${column} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`

const columns = `id, date, title, amount, type, account_id, to_account_id, category_id,
  recurring_item_id, savings_goal_id, loan_id, loan_installment_id, installment_plan_id,
  planned_date, note, created_at, updated_at, is_month_total`

const sql = /* sql */ `
CREATE TABLE transactions_new (
  id                  INTEGER PRIMARY KEY,
  date                TEXT    NOT NULL CHECK (${isDate('date')}),
  title               TEXT    NOT NULL,
  amount              INTEGER NOT NULL CHECK (amount > 0),
  type                TEXT    NOT NULL CHECK (type IN (
                        'income', 'expense', 'transfer',
                        'savings_deposit', 'savings_withdrawal', 'loan_out', 'loan_in',
                        'adjustment_in', 'adjustment_out')),
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
  is_month_total      INTEGER NOT NULL DEFAULT 0 CHECK (is_month_total IN (0, 1)),
  CHECK ((type = 'transfer') = (to_account_id IS NOT NULL)),
  CHECK (to_account_id IS NULL OR to_account_id <> account_id),
  CHECK (type NOT IN ('income', 'expense') OR category_id IS NOT NULL),
  CHECK (type IN ('income', 'expense') OR category_id IS NULL),
  CHECK ((type IN ('savings_deposit', 'savings_withdrawal')) = (savings_goal_id IS NOT NULL)),
  CHECK ((type IN ('loan_out', 'loan_in')) = (loan_id IS NOT NULL)),
  CHECK (loan_installment_id IS NULL OR loan_id IS NOT NULL),
  CHECK (planned_date IS NULL OR recurring_item_id IS NOT NULL
         OR installment_plan_id IS NOT NULL OR loan_installment_id IS NOT NULL),
  -- An adjustment stands on its own: no plan, item or month summary behind it.
  CHECK (type NOT IN ('adjustment_in', 'adjustment_out')
         OR (recurring_item_id IS NULL AND installment_plan_id IS NULL AND is_month_total = 0))
) STRICT;

INSERT INTO transactions_new (${columns}) SELECT ${columns} FROM transactions;
DROP TABLE transactions;
ALTER TABLE transactions_new RENAME TO transactions;

CREATE INDEX transactions_date          ON transactions (date);
CREATE INDEX transactions_account_date  ON transactions (account_id, date);
CREATE INDEX transactions_to_account    ON transactions (to_account_id) WHERE to_account_id IS NOT NULL;
CREATE INDEX transactions_category_date ON transactions (category_id, date);
CREATE INDEX transactions_type_date     ON transactions (type, date);
CREATE INDEX transactions_savings_goal  ON transactions (savings_goal_id) WHERE savings_goal_id IS NOT NULL;
CREATE INDEX transactions_loan          ON transactions (loan_id) WHERE loan_id IS NOT NULL;

CREATE UNIQUE INDEX transactions_settles_recurring ON transactions (recurring_item_id, planned_date)
  WHERE recurring_item_id IS NOT NULL AND planned_date IS NOT NULL;
CREATE UNIQUE INDEX transactions_settles_plan ON transactions (installment_plan_id, planned_date)
  WHERE installment_plan_id IS NOT NULL AND planned_date IS NOT NULL;
CREATE UNIQUE INDEX transactions_settles_loan_installment ON transactions (loan_installment_id)
  WHERE loan_installment_id IS NOT NULL;

CREATE UNIQUE INDEX transactions_month_total_category
  ON transactions (category_id, substr(date, 1, 7))
  WHERE is_month_total = 1 AND category_id IS NOT NULL;
CREATE UNIQUE INDEX transactions_month_total_card
  ON transactions (to_account_id, substr(date, 1, 7))
  WHERE is_month_total = 1 AND type = 'transfer';
CREATE UNIQUE INDEX transactions_month_total_goal
  ON transactions (savings_goal_id, substr(date, 1, 7))
  WHERE is_month_total = 1 AND savings_goal_id IS NOT NULL;

CREATE TRIGGER transactions_touch_updated_at
AFTER UPDATE ON transactions FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE transactions SET updated_at = ${NOW} WHERE id = NEW.id;
END;
`

export const migration005: Migration = { version: 5, name: 'balance adjustments', sql }

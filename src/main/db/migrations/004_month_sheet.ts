import type { Migration } from '../migrate'

// The Month sheet (PLAN.md steps 33–36). Typing an amount on the sheet creates or updates a
// row's one monthly summary transaction (is_month_total), so each row has at most one per
// month: a category's income or expense, a card's payment (a transfer into it) or a goal's
// deposit. month_rows are the categories added to the sheet.
const sql = /* sql */ `
ALTER TABLE transactions ADD COLUMN is_month_total INTEGER NOT NULL DEFAULT 0
  CHECK (is_month_total IN (0, 1));

CREATE UNIQUE INDEX transactions_month_total_category
  ON transactions (category_id, substr(date, 1, 7))
  WHERE is_month_total = 1 AND category_id IS NOT NULL;
CREATE UNIQUE INDEX transactions_month_total_card
  ON transactions (to_account_id, substr(date, 1, 7))
  WHERE is_month_total = 1 AND type = 'transfer';
CREATE UNIQUE INDEX transactions_month_total_goal
  ON transactions (savings_goal_id, substr(date, 1, 7))
  WHERE is_month_total = 1 AND savings_goal_id IS NOT NULL;

CREATE TABLE month_rows (
  id                 INTEGER PRIMARY KEY,
  section            TEXT    NOT NULL CHECK (section IN ('income', 'expense')),
  category_id        INTEGER NOT NULL UNIQUE REFERENCES categories (id) ON DELETE CASCADE,
  default_account_id INTEGER REFERENCES accounts (id) ON DELETE SET NULL,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  is_hidden          INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1))
) STRICT;
`

export const migration004: Migration = { version: 4, name: 'month sheet', sql }

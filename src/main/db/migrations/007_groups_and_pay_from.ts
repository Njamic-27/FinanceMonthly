import type { Migration } from '../migrate'

// Cards as bills and category groups (PLAN.md §2, step 48).
// - categories.expense_group: everyday, bills or subscriptions, for expense categories.
// - categories.builtin_key: the seeded categories, so a language switch can rename the ones
//   still carrying their default name (step 55).
// - accounts.pay_from_account_id: the debit account a credit card's bill is paid from.
// - The card_spending_month setting goes: card spending always counts on its bill's due date
//   (counts_on), so the triggers from migration 006 are recreated without it.

/** The counted day of the `transactions` row being updated (migration 006, less the setting). */
const countsOn = /* sql */ `
  CASE WHEN transactions.type IN ('income', 'expense') AND transactions.is_month_total = 0
       THEN coalesce((SELECT bill_due_date(transactions.date, a.statement_day, a.payment_due_day)
                      FROM accounts a
                      WHERE a.id = transactions.account_id AND a.type = 'credit'
                        AND a.statement_day IS NOT NULL AND a.payment_due_day IS NOT NULL),
                     transactions.date)
       ELSE transactions.date END`

const builtins: [key: string, type: string, name: string][] = [
  ['salary', 'income', 'Salary'],
  ['bonus', 'income', 'Bonus'],
  ['other_income', 'income', 'Other income'],
  ['groceries', 'expense', 'Groceries'],
  ['rent', 'expense', 'Rent'],
  ['utilities', 'expense', 'Utilities'],
  ['transport', 'expense', 'Transport'],
  ['eating_out', 'expense', 'Eating out'],
  ['health', 'expense', 'Health'],
  ['shopping', 'expense', 'Shopping'],
  ['entertainment', 'expense', 'Entertainment'],
  ['subscriptions', 'expense', 'Subscriptions'],
  ['other', 'expense', 'Other']
]

const sql = /* sql */ `
ALTER TABLE categories ADD COLUMN expense_group TEXT
  CHECK (expense_group IS NULL OR expense_group IN ('everyday', 'bills', 'subscriptions'));
UPDATE categories
SET expense_group = CASE WHEN name IN ('Rent', 'Utilities') THEN 'bills'
                         WHEN name = 'Subscriptions' THEN 'subscriptions'
                         ELSE 'everyday' END
WHERE type = 'expense';

ALTER TABLE categories ADD COLUMN builtin_key TEXT;
${builtins
  .map(
    ([key, type, name]) =>
      `UPDATE categories SET builtin_key = '${key}' WHERE type = '${type}' AND name = '${name}';`
  )
  .join('\n')}
CREATE UNIQUE INDEX categories_builtin_key ON categories (builtin_key)
  WHERE builtin_key IS NOT NULL;

ALTER TABLE accounts ADD COLUMN pay_from_account_id INTEGER
  REFERENCES accounts (id) ON DELETE SET NULL;
UPDATE accounts
SET pay_from_account_id = (SELECT d.id FROM accounts d WHERE d.type = 'debit'
                           ORDER BY d.is_archived, d.sort_order, d.id LIMIT 1)
WHERE type = 'credit';

DROP TRIGGER settings_counts_on_insert;
DROP TRIGGER settings_counts_on_update;
DROP TRIGGER transactions_counts_on_insert;
DROP TRIGGER transactions_counts_on_update;
DROP TRIGGER accounts_counts_on;
DELETE FROM settings WHERE key = 'card_spending_month';

CREATE TRIGGER transactions_counts_on_insert
AFTER INSERT ON transactions FOR EACH ROW
BEGIN
  UPDATE transactions SET counts_on = ${countsOn} WHERE id = NEW.id;
END;

CREATE TRIGGER transactions_counts_on_update
AFTER UPDATE OF date, type, account_id, is_month_total ON transactions FOR EACH ROW
BEGIN
  UPDATE transactions SET counts_on = ${countsOn} WHERE id = NEW.id;
END;

CREATE TRIGGER accounts_counts_on
AFTER UPDATE OF type, statement_day, payment_due_day ON accounts FOR EACH ROW
BEGIN
  UPDATE transactions SET counts_on = ${countsOn} WHERE account_id = NEW.id;
END;

-- Spending that counted by purchase date under the old setting now counts on its bill.
UPDATE transactions SET counts_on = ${countsOn};
`

export const migration007: Migration = { version: 7, name: 'groups and pay from', sql }

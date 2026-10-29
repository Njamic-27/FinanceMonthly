import type { Migration } from '../migrate'

// Card spending counts when the card is paid (PLAN.md §2, step 42). `counts_on` is the day a
// transaction counts as income or spending: its date, except income and expenses on a credit
// card with both its days set, which count on the due date of the bill they're on
// (bill_due_date, registered in ../functions.ts). Month-sheet summaries stay in their month,
// and the setting card_spending_month = "purchase" keeps every date. Triggers keep it current
// when a transaction, a card's days or the setting change; balances still use `date`.

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

/** The counted day of the `transactions` row being updated. */
const countsOn = /* sql */ `
  CASE WHEN transactions.type IN ('income', 'expense') AND transactions.is_month_total = 0
            AND coalesce((SELECT value FROM settings WHERE key = 'card_spending_month'),
                         '"payment"') <> '"purchase"'
       THEN coalesce((SELECT bill_due_date(transactions.date, a.statement_day, a.payment_due_day)
                      FROM accounts a
                      WHERE a.id = transactions.account_id AND a.type = 'credit'
                        AND a.statement_day IS NOT NULL AND a.payment_due_day IS NOT NULL),
                     transactions.date)
       ELSE transactions.date END`

const sql = /* sql */ `
ALTER TABLE transactions ADD COLUMN counts_on TEXT
  CHECK (counts_on IS NULL OR counts_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]');

UPDATE transactions SET counts_on = ${countsOn};

CREATE INDEX transactions_counts_on      ON transactions (counts_on);
CREATE INDEX transactions_type_counts_on ON transactions (type, counts_on);

-- Filled in right after the row is written (a trigger can't set NEW before the insert).
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

CREATE TRIGGER settings_counts_on_insert
AFTER INSERT ON settings FOR EACH ROW WHEN NEW.key = 'card_spending_month'
BEGIN
  UPDATE transactions SET counts_on = ${countsOn} WHERE type IN ('income', 'expense');
END;

CREATE TRIGGER settings_counts_on_update
AFTER UPDATE ON settings FOR EACH ROW WHEN NEW.key = 'card_spending_month'
BEGIN
  UPDATE transactions SET counts_on = ${countsOn} WHERE type IN ('income', 'expense');
END;

-- Working out counts_on isn't an edit: updated_at only follows the columns you change.
DROP TRIGGER transactions_touch_updated_at;
CREATE TRIGGER transactions_touch_updated_at
AFTER UPDATE OF date, title, amount, type, account_id, to_account_id, category_id,
  recurring_item_id, savings_goal_id, loan_id, loan_installment_id, installment_plan_id,
  planned_date, note, is_month_total ON transactions FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE transactions SET updated_at = ${NOW} WHERE id = NEW.id;
END;
`

export const migration006: Migration = { version: 6, name: 'counts on', sql }

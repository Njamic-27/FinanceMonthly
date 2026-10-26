import type { Migration } from '../migrate'

// Starting categories (PLAN.md §2). Colours follow the validated order in
// src/shared/categories.ts; "Other" categories use the neutral slate.
const sql = /* sql */ `
INSERT INTO categories (name, type, color, icon, sort_order) VALUES
  ('Salary',        'income',  'blue',   'briefcase',       1),
  ('Bonus',         'income',  'orange', 'gift',            2),
  ('Other income',  'income',  'slate',  'coins',           3),
  ('Groceries',     'expense', 'blue',   'shopping-cart',   1),
  ('Rent',          'expense', 'orange', 'house',           2),
  ('Utilities',     'expense', 'aqua',   'zap',             3),
  ('Transport',     'expense', 'plum',   'bus',             4),
  ('Eating out',    'expense', 'olive',  'utensils',        5),
  ('Health',        'expense', 'pink',   'heart-pulse',     6),
  ('Shopping',      'expense', 'brown',  'shopping-bag',    7),
  ('Entertainment', 'expense', 'sky',    'film',            8),
  ('Subscriptions', 'expense', 'aqua',   'repeat',          9),
  ('Other',         'expense', 'slate',  'circle-ellipsis', 10);
`

export const migration002: Migration = { version: 2, name: 'default categories', sql }

import type { Migration } from '../migrate'

// Installment numbers without brackets (PLAN.md step 52): the transactions posted by an
// installment plan or a bank loan installment were titled "Laptop (2/5)"; they become
// "Laptop 2/5". Only a title ending in " (digits/digits)" changes.
//
// SQLite has no regex: rtrim(title, <title without "(">) cuts the title back to its last "(",
// which gives the head ("Laptop (") and the tail ("2/5)").

const head = /* sql */ `rtrim(title, replace(title, '(', ''))`
const tail = /* sql */ `substr(title, length(${head}) + 1)`

const sql = /* sql */ `
UPDATE transactions
SET title = substr(${head}, 1, length(${head}) - 2) || ' ' || substr(${tail}, 1, length(${tail}) - 1)
WHERE (installment_plan_id IS NOT NULL OR loan_installment_id IS NOT NULL)
  AND title LIKE '% (%/%)'
  AND ${head} LIKE '% ('
  AND ${tail} GLOB '[0-9]*/[0-9]*)'
  AND ${tail} NOT GLOB '*[^0-9/)]*';
`

export const migration008: Migration = { version: 8, name: 'installment numbers', sql }

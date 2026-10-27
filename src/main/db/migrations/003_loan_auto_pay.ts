import type { Migration } from '../migrate'

// Bank loans pay themselves on each due date unless turned off (PLAN.md step 32). Existing
// loans get it too: banks take installments by direct debit.
const sql = /* sql */ `
ALTER TABLE loans ADD COLUMN auto_pay INTEGER NOT NULL DEFAULT 1 CHECK (auto_pay IN (0, 1));
`

export const migration003: Migration = { version: 3, name: 'loan auto pay', sql }

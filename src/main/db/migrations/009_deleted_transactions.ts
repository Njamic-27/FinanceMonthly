import type { Migration } from '../migrate'

// Recently deleted transactions, so a deletion can be undone: each keeps the whole row as it
// was (JSON), to be put back with its links (recurring item, planned date) as they were.

const sql = /* sql */ `
CREATE TABLE deleted_transactions (
  id         INTEGER PRIMARY KEY,
  row        TEXT    NOT NULL CHECK (json_valid(row)),
  deleted_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
`

export const migration009: Migration = { version: 9, name: 'deleted transactions', sql }

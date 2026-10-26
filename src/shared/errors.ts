/**
 * - `validation` — the input was rejected; the message says what to fix.
 * - `not_found`  — the record no longer exists.
 * - `conflict`   — the change clashes with existing data (e.g. a duplicate name).
 * - `internal`   — anything unexpected; details are logged in the main process.
 */
export type ErrorCode = 'validation' | 'not_found' | 'conflict' | 'internal'

export interface SerializedError {
  code: ErrorCode
  message: string
}

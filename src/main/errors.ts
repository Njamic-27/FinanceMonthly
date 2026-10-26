import Database from 'better-sqlite3'
import { ZodError } from 'zod'
import type { ErrorCode, SerializedError } from '@shared/errors'

/** An error whose message is safe and useful to show to the user. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function toSerializedError(error: unknown): SerializedError {
  if (error instanceof AppError) return { code: error.code, message: error.message }

  if (error instanceof ZodError) {
    const issue = error.issues[0]
    const field = issue?.path.join('.')
    return {
      code: 'validation',
      message: issue ? (field ? `${field}: ${issue.message}` : issue.message) : 'Invalid input'
    }
  }

  if (error instanceof Database.SqliteError) {
    if (
      error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY'
    ) {
      return { code: 'conflict', message: 'That already exists.' }
    }
    if (error.code.startsWith('SQLITE_CONSTRAINT')) {
      console.error('[db] constraint failed:', error.message)
      return { code: 'validation', message: 'The data was rejected by the database.' }
    }
  }

  console.error('[ipc] unexpected error:', error)
  return {
    code: 'internal',
    message: error instanceof Error ? error.message : 'Something went wrong.'
  }
}

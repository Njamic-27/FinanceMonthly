import Database from 'better-sqlite3'
import { ZodError } from 'zod'
import type { ErrorCode, SerializedError } from '@shared/errors'
import { t, translateMessage } from '@shared/i18n'

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
      message: issue
        ? field
          ? `${field}: ${translateMessage(issue.message)}`
          : translateMessage(issue.message)
        : t('errors.invalidInput')
    }
  }

  if (error instanceof Database.SqliteError) {
    if (
      error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY'
    ) {
      return { code: 'conflict', message: t('errors.alreadyExists') }
    }
    if (error.code.startsWith('SQLITE_CONSTRAINT')) {
      console.error('[db] constraint failed:', error.message)
      return { code: 'validation', message: t('errors.rejected') }
    }
  }

  console.error('[ipc] unexpected error:', error)
  return {
    code: 'internal',
    message: error instanceof Error ? error.message : t('errors.somethingWrong')
  }
}

import type { ZodError } from 'zod'

/** The first message for each top-level field, e.g. `{ name: 'Give the account a name' }`. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '')
    errors[field] ??= issue.message
  }
  return errors
}

/** Marks an input invalid and links it to its message (`<FieldError id={`${id}-error`}>`). */
export function errorProps(
  id: string,
  message?: string
): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
  return message ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {}
}

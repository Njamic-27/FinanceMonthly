import { MAX_INSTALLMENTS, MIN_INSTALLMENTS } from '@shared/installments'

/** The installments count as a number, or null while it isn't a valid one. */
export function parseCount(value: string): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n >= MIN_INSTALLMENTS && n <= MAX_INSTALLMENTS ? n : null
}

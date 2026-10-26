import { useSyncExternalStore } from 'react'
import type { IsoDate } from '@shared/dates'
import type { Cents } from '@shared/money'
import type { Transaction } from '@shared/transactions'

/**
 * Values a screen can fill in before opening "Add transaction": the Calendar's day, the
 * filtered account, or a whole transaction to duplicate.
 */
export interface TransactionPrefill {
  type?: 'income' | 'expense'
  date?: IsoDate
  accountId?: number
  categoryId?: number
  amount?: Cents
  title?: string
  note?: string | null
}

export type TransactionDialogTarget =
  { kind: 'new'; prefill?: TransactionPrefill } | { kind: 'edit'; id: number }

// One dialog for the whole app (rendered by AppShell); any screen opens it through here.
let target: TransactionDialogTarget | null = null
const listeners = new Set<() => void>()

function set(next: TransactionDialogTarget | null): void {
  target = next
  for (const listener of listeners) listener()
}

export function openTransactionDialog(next: TransactionDialogTarget = { kind: 'new' }): void {
  set(next)
}

export function closeTransactionDialog(): void {
  set(null)
}

export function useTransactionDialogTarget(): TransactionDialogTarget | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => target
  )
}

/** Opens "Add transaction" with a copy of an income or expense, dated today. */
export function duplicateTransaction(tx: Transaction): void {
  if (tx.type !== 'income' && tx.type !== 'expense') return
  openTransactionDialog({
    kind: 'new',
    prefill: {
      type: tx.type,
      title: tx.title,
      amount: tx.amount,
      accountId: tx.accountId,
      categoryId: tx.categoryId ?? undefined,
      note: tx.note
    }
  })
}

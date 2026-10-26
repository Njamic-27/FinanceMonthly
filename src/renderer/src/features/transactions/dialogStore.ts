import { useSyncExternalStore } from 'react'
import type { IsoDate } from '@shared/dates'

/** Values a screen can fill in before opening "Add transaction" (e.g. the Calendar's day). */
export interface TransactionPrefill {
  type?: 'income' | 'expense'
  date?: IsoDate
  accountId?: number
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

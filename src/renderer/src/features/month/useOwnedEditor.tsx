import { useState } from 'react'
import type { Transaction } from '@shared/transactions'
import { useLoans, useUnpayInstallment } from '@renderer/features/loans/queries'
import {
  RepaymentDialog,
  type RepaymentDialogTarget
} from '@renderer/features/loans/RepaymentDialog'
import {
  MovementDialog,
  type MovementDialogTarget
} from '@renderer/features/savings/MovementDialog'
import { useSavingsGoals } from '@renderer/features/savings/queries'
import { toast } from '@renderer/lib/toast'
import { Confirm } from './Confirm'
import { t } from '@renderer/lib/i18n'

/**
 * Savings and loan movements open in their own dialogs where the list is, on Month: a deposit or
 * withdrawal, a repayment, or (for a bank loan installment) undoing its payment. `open` goes to
 * a transaction list's `onOpenOwned`; `dialogs` is rendered next to the list.
 */
export function useOwnedEditor(): {
  open: (tx: Transaction) => void
  dialogs: React.JSX.Element
} {
  const loans = useLoans().data ?? []
  const goals = useSavingsGoals().data ?? []
  const unpay = useUnpayInstallment()
  const [movement, setMovement] = useState<MovementDialogTarget | null>(null)
  const [repayment, setRepayment] = useState<RepaymentDialogTarget | null>(null)
  const [undoing, setUndoing] = useState<Transaction | null>(null)

  const open = (tx: Transaction): void => {
    const goal = goals.find((g) => g.id === tx.savingsGoalId)
    if (goal) {
      setMovement({ kind: 'edit', goal, movement: tx })
      return
    }
    const loan = loans.find((l) => l.id === tx.loanId)
    if (!loan) return
    if (loan.kind !== 'bank_loan') setRepayment({ kind: 'edit', loan, repayment: tx })
    else if (tx.loanInstallmentId !== null) setUndoing(tx)
  }

  const dialogs = (
    <>
      <MovementDialog target={movement} onClose={() => setMovement(null)} />
      <RepaymentDialog target={repayment} onClose={() => setRepayment(null)} />
      <Confirm
        open={undoing !== null}
        title={t('owned.undoTitle')}
        description={t('owned.undoDescription')}
        action={t('owned.undoAction')}
        pending={unpay.isPending}
        onCancel={() => setUndoing(null)}
        onConfirm={() => {
          if (undoing?.loanInstallmentId == null) return
          unpay.mutate(undoing.loanInstallmentId, {
            onSuccess: () => {
              toast({ title: t('owned.undone'), variant: 'success' })
              setUndoing(null)
            },
            onError: (error) =>
              toast({ title: t('owned.notUndone'), description: error.message, variant: 'error' })
          })
        }}
      />
    </>
  )
  return { open, dialogs }
}
